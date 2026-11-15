"use client";

import { useEffect, useRef, useState } from "react";
import { compactButtonClass, compactPrimaryButtonClass } from "@/components/auth-shell";
import {
  SCRIBE_ASSESSMENT_KEYS,
  draftToAssessment,
  fieldsToCheck,
  medicineNotes,
  type ScribeAssessmentKey,
  type ScribeAssessmentPatch,
  type ScribeDraft,
  type ScribeMedicine,
} from "@/lib/scribe/draft-schema";

type SessionStatus = "RECORDING" | "TRANSCRIBED" | "DRAFTED" | "APPLIED" | "DISCARDED";

type SessionView = {
  id: string;
  status: SessionStatus;
  transcript: string;
  translation: string;
  draft: ScribeDraft | null;
  chunkCount: number;
  consentAt: string;
  updatedAt: string;
};

const FIELD_LABELS: Record<ScribeAssessmentKey, string> = {
  chiefComplaint: "Chief complaints",
  examination: "Examination",
  diagnosis: "Diagnosis",
  summary: "History of present illness",
  prescription: "Prescription",
  advice: "Advice",
  followUpAt: "Follow-up",
  visitOutcome: "Outcome",
};

function recorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function micMessage(error: unknown) {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "Allow the microphone to record the consultation.";
  }
  return "Could not use the microphone.";
}

export function ConsultScribe({
  appointmentId,
  mode = "edit",
  onApply,
}: {
  appointmentId: string;
  mode?: "edit" | "view";
  onApply?: (patch: ScribeAssessmentPatch, uncertain: ScribeAssessmentKey[]) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [session, setSession] = useState<SessionView | null>(null);
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [consent, setConsent] = useState(false);
  const [live, setLive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [failedChunk, setFailedChunk] = useState(false);
  const [editor, setEditor] = useState<ScribeDraft | null>(null);
  const [included, setIncluded] = useState<Partial<Record<ScribeAssessmentKey, boolean>>>({});

  const recordingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const segmentTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const seqRef = useRef(1);
  const uploadChainRef = useRef(Promise.resolve());
  const failedBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/appointments/${appointmentId}/scribe/session`)
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          configured?: boolean;
          session?: SessionView | null;
        };
        if (cancelled) return;
        if (response.status === 403) {
          setHidden(true);
          return;
        }
        if (!response.ok) {
          if (mode === "edit") setError(data.error ?? "Could not load the scribe.");
          return;
        }
        setConfigured(data.configured !== false);
        if (data.session) {
          setSession(data.session);
          setTranscript(data.session.transcript ?? "");
          setTranslation(data.session.translation ?? "");
          sessionIdRef.current = data.session.id;
          seqRef.current = (data.session.chunkCount ?? 0) + 1;
          if (data.session.draft && (data.session.status === "DRAFTED" || data.session.status === "APPLIED")) {
            setEditor(data.session.draft);
            setIncluded(includedFields(data.session.draft));
          }
        }
      })
      .catch(() => {
        if (!cancelled && mode === "edit") setError("Could not load the scribe.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, mode]);

  useEffect(() => {
    if (!live) return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => {
    return () => {
      recordingRef.current = false;
      if (segmentTimerRef.current != null) window.clearTimeout(segmentTimerRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function remember(next: SessionView) {
    setSession(next);
    setTranscript(next.transcript ?? "");
    setTranslation(next.translation ?? "");
    sessionIdRef.current = next.id;
    seqRef.current = (next.chunkCount ?? 0) + 1;
    if (next.draft && (next.status === "DRAFTED" || next.status === "APPLIED")) {
      setEditor(next.draft);
      setIncluded(includedFields(next.draft));
    } else if (next.status === "RECORDING" || next.status === "TRANSCRIBED") {
      setEditor(null);
    }
  }

  async function sendChunk(blob: Blob) {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const seq = seqRef.current;
    const body = new FormData();
    body.set("audio", blob, "consult.webm");
    body.set("sessionId", sessionId);
    body.set("seq", String(seq));
    const response = await fetch(`/api/appointments/${appointmentId}/scribe/transcribe`, {
      method: "POST",
      body,
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      transcript?: string;
      translation?: string;
      chunkCount?: number;
      session?: SessionView;
    };
    if (!response.ok) {
      if (response.status === 409 && typeof data.chunkCount === "number" && data.chunkCount >= seq) {
        seqRef.current = data.chunkCount + 1;
        if (typeof data.transcript === "string") setTranscript(data.transcript);
        if (typeof data.session?.translation === "string") setTranslation(data.session.translation);
        else if (typeof data.translation === "string") setTranslation(data.translation);
        failedBlobRef.current = null;
        setFailedChunk(false);
        return;
      }
      failedBlobRef.current = blob;
      setFailedChunk(true);
      throw new Error(data.error ?? "Could not save that part of the conversation.");
    }
    failedBlobRef.current = null;
    setFailedChunk(false);
    if (typeof data.chunkCount === "number") seqRef.current = data.chunkCount + 1;
    if (typeof data.transcript === "string") setTranscript(data.transcript);
    if (typeof data.session?.translation === "string") setTranslation(data.session.translation);
  }

  function enqueue(blob: Blob) {
    uploadChainRef.current = uploadChainRef.current
      .catch(() => undefined)
      .then(() => sendChunk(blob))
      .catch((reason: unknown) => {
        recordingRef.current = false;
        if (segmentTimerRef.current != null) window.clearTimeout(segmentTimerRef.current);
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        setLive(false);
        setError(reason instanceof Error ? reason.message : "Could not save that part of the conversation.");
        throw reason;
      });
  }

  function startSegment() {
    const stream = streamRef.current;
    if (!stream || !recordingRef.current) return;
    const mime = recorderMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      setError("This browser cannot record audio. Use Chrome or Edge.");
      recordingRef.current = false;
      setLive(false);
      stopTracks();
      return;
    }
    recorderRef.current = rec;
    const parts: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) parts.push(event.data);
    };
    rec.onstop = () => {
      const blob = new Blob(parts, { type: rec.mimeType || mime || "audio/webm" });
      const keepGoing = recordingRef.current;
      if (failedBlobRef.current) return;
      if (blob.size > 0) enqueue(blob);
      if (keepGoing) startSegment();
    };
    try {
      rec.start();
    } catch {
      setError("Could not start recording.");
      recordingRef.current = false;
      setLive(false);
      stopTracks();
      return;
    }
    if (segmentTimerRef.current != null) window.clearTimeout(segmentTimerRef.current);
    segmentTimerRef.current = window.setTimeout(() => {
      if (rec.state === "recording") rec.stop();
    }, 8_000);
  }

  async function beginStream() {
    if (typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio. Use Chrome or Edge.");
      return false;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (reason) {
      setError(micMessage(reason));
      return false;
    }
    recordingRef.current = true;
    setLive(true);
    setElapsed(0);
    startSegment();
    return true;
  }

  async function startRecording() {
    setError("");
    setBusy("start");
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", consent: true }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; session?: SessionView };
      if (!response.ok || !data.session) {
        setError(data.error ?? "Could not start the recording.");
        return;
      }
      remember(data.session);
      await beginStream();
    } finally {
      setBusy("");
    }
  }

  async function continueRecording() {
    setError("");
    await beginStream();
  }

  async function finishUploads() {
    recordingRef.current = false;
    if (segmentTimerRef.current != null) {
      window.clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") {
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
        rec.stop();
      });
    }
    setLive(false);
    stopTracks();
    await uploadChainRef.current;
  }

  async function draftNote() {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    setBusy("draft");
    setError("");
    try {
      if (recordingRef.current || recorderRef.current?.state === "recording") {
        await finishUploads();
      } else {
        await uploadChainRef.current;
      }
      if (failedBlobRef.current) return;
      const response = await fetch(`/api/appointments/${appointmentId}/scribe/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; session?: SessionView };
      if (!response.ok || !data.session) {
        setError(data.error ?? "Could not draft the visit note.");
        return;
      }
      remember(data.session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not draft the visit note.");
    } finally {
      setBusy("");
    }
  }

  async function retryChunk() {
    const blob = failedBlobRef.current;
    if (!blob) return;
    setError("");
    setBusy("retry");
    uploadChainRef.current = Promise.resolve();
    try {
      await sendChunk(blob);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save that part of the conversation.");
    } finally {
      setBusy("");
    }
  }

  async function discard() {
    if (!session) return;
    setBusy("discard");
    setError("");
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discard", sessionId: session.id }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not discard the recording.");
        return;
      }
      setSession(null);
      setEditor(null);
      setTranscript("");
      setTranslation("");
      sessionIdRef.current = null;
      seqRef.current = 1;
      setConsent(false);
    } finally {
      setBusy("");
    }
  }

  async function applyDraft() {
    if (!session || !editor) return;
    setBusy("apply");
    setError("");
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "applied", sessionId: session.id, draft: editor }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; session?: SessionView };
      if (!response.ok || !data.session) {
        setError(data.error ?? "Could not apply the draft.");
        return;
      }
      remember(data.session);
      const values = draftToAssessment(editor);
      const patch: ScribeAssessmentPatch = {};
      for (const key of SCRIBE_ASSESSMENT_KEYS) {
        if (included[key]) patch[key] = values[key];
      }
      const uncertain = fieldsToCheck(editor).filter((key) => included[key]);
      onApply?.(patch, uncertain);
    } finally {
      setBusy("");
    }
  }

  function updateMedicine(index: number, patch: Partial<ScribeMedicine>) {
    setEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        medicines: current.medicines.map((medicine, item) => {
          if (item !== index) return medicine;
          const next = { ...medicine, ...patch };
          if (patch.name != null && patch.name !== medicine.name) next.matched = false;
          return next;
        }),
      };
    });
  }

  if (hidden || (mode === "view" && (loading || !session || (!session.transcript && !session.translation && !session.draft)))) {
    return null;
  }

  const checks = new Set(editor ? fieldsToCheck(editor) : []);
  const openRecording = session?.status === "RECORDING" || session?.status === "TRANSCRIBED";
  const showReview = Boolean(editor) && !live && (session?.status === "DRAFTED" || session?.status === "APPLIED");

  const transcriptBlock = (
    <div>
      <p className="text-[13px] font-semibold text-text-primary">Recorded conversation</p>
      <div
        aria-live="polite"
        className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-app-bg px-2.5 py-2 text-[13px] text-text-primary"
      >
        {transcript.trim() || "Waiting for speech…"}
      </div>
    </div>
  );

  const liveText = (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="text-[13px] font-semibold text-text-primary">Live translation</p>
        <div
          aria-live="polite"
          className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-app-bg px-2.5 py-2 text-[13px] text-text-primary"
        >
          {translation.trim() || (live ? "Listening…" : "No translation yet.")}
        </div>
      </div>
      {transcriptBlock}
    </div>
  );

  return (
    <section className="print:hidden max-h-[46vh] shrink-0 overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-text-primary">AI scribe</h3>
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-critical">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-critical" />
              </span>
              Recording {formatElapsed(elapsed)}
            </span>
          ) : null}
        </div>
        {session?.status === "APPLIED" && !live ? (
          <p className="text-[11px] text-text-secondary">Applied. Approve the assessment when the note is correct.</p>
        ) : null}
      </div>

      {loading ? <p className="mt-2 text-xs text-text-secondary">Loading scribe…</p> : null}

      {!loading && mode === "view" && session ? (
        <div className="mt-2 space-y-3">
          {liveText}
          <DraftReadout draft={session.draft} />
        </div>
      ) : null}

      {!loading && mode === "edit" && !configured && !session ? (
        <p className="mt-2 text-[13px] text-text-secondary">
          AI scribe is on for this hospital, but the server has no OpenAI API key.
        </p>
      ) : null}

      {!loading && mode === "edit" && !session && configured ? (
        <div className="mt-2 space-y-2">
          <p className="text-[13px] text-text-secondary">
            Talk with the patient. English wording appears here as you speak, including when the conversation is in another language. Nothing reaches
            the pharmacy until you approve.
          </p>
          <label className="flex items-start gap-2 text-[13px] text-text-primary">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>Patient has agreed to this conversation being recorded</span>
          </label>
          <button
            type="button"
            className={compactPrimaryButtonClass}
            disabled={!consent || Boolean(busy)}
            onClick={() => void startRecording()}
          >
            {busy === "start" ? "Starting…" : "Start"}
          </button>
        </div>
      ) : null}

      {!loading && mode === "edit" && session && (live || openRecording) && !showReview ? (
        <div className="mt-2 space-y-2">
          {liveText}
          <div className="flex flex-wrap gap-2">
            {live ? (
              <button type="button" className={compactPrimaryButtonClass} disabled={Boolean(busy)} onClick={() => void draftNote()}>
                {busy === "draft" ? "Drafting…" : "Stop and draft"}
              </button>
            ) : (
              <>
                <button type="button" className={compactPrimaryButtonClass} disabled={Boolean(busy)} onClick={() => void continueRecording()}>
                  Continue
                </button>
                <button type="button" className={compactButtonClass} disabled={Boolean(busy)} onClick={() => void draftNote()}>
                  {busy === "draft" ? "Drafting…" : "Draft note"}
                </button>
              </>
            )}
            {failedChunk ? (
              <button type="button" className={compactButtonClass} disabled={Boolean(busy)} onClick={() => void retryChunk()}>
                {busy === "retry" ? "Retrying…" : "Retry last part"}
              </button>
            ) : null}
            {!live ? (
              <button type="button" className={compactButtonClass} disabled={Boolean(busy)} onClick={() => void discard()}>
                Discard
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && mode === "edit" && showReview && editor ? (
        <div className="mt-2 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-text-primary">Live translation</p>
                <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-app-bg px-2.5 py-2 text-[13px] text-text-primary">
                  {translation.trim() || "No translation yet."}
                </div>
              </div>
              {transcriptBlock}
            </div>
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-text-primary">AI draft</p>
              {SCRIBE_ASSESSMENT_KEYS.filter((key) => key !== "prescription").map((key) => (
                <label key={key} className="block text-[11px] font-medium text-text-secondary">
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1">
                      {FIELD_LABELS[key]}
                      {checks.has(key) ? (
                        <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">Check</span>
                      ) : null}
                    </span>
                    <span className="inline-flex items-center gap-1 font-normal">
                      <input
                        type="checkbox"
                        checked={Boolean(included[key])}
                        onChange={(event) => setIncluded((current) => ({ ...current, [key]: event.target.checked }))}
                      />
                      Use
                    </span>
                  </span>
                  {key === "visitOutcome" ? (
                    <select
                      className="h-8 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text-primary"
                      value={editor.outcome}
                      onChange={(event) =>
                        setEditor({ ...editor, outcome: event.target.value as ScribeDraft["outcome"] })
                      }
                    >
                      <option value="">Not mentioned</option>
                      <option value="FOLLOW_UP">Follow up</option>
                      <option value="DISCHARGE">Discharge</option>
                    </select>
                  ) : key === "followUpAt" ? (
                    <input
                      className="h-8 w-full rounded-lg border border-border px-2 text-sm text-text-primary"
                      inputMode="numeric"
                      placeholder="Days until review"
                      value={editor.followUpInDays ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        const days = raw ? Number(raw) : null;
                        setEditor({
                          ...editor,
                          followUpInDays: days != null && Number.isInteger(days) && days > 0 ? days : null,
                          outcome: editor.outcome || (days ? "FOLLOW_UP" : ""),
                        });
                      }}
                    />
                  ) : (
                    <textarea
                      className="min-h-14 w-full resize-y rounded-lg border border-border px-2 py-1.5 text-sm text-text-primary"
                      value={draftFieldValue(editor, key)}
                      placeholder="Not mentioned"
                      onChange={(event) => setEditor(setDraftField(editor, key, event.target.value))}
                    />
                  )}
                </label>
              ))}
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary">
                    Prescription
                    {checks.has("prescription") ? (
                      <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">Check</span>
                    ) : null}
                  </p>
                  <label className="inline-flex items-center gap-1 text-[11px] font-normal text-text-secondary">
                    <input
                      type="checkbox"
                      checked={Boolean(included.prescription)}
                      onChange={(event) =>
                        setIncluded((current) => ({ ...current, prescription: event.target.checked }))
                      }
                    />
                    Use
                  </label>
                </div>
                {editor.medicines.length === 0 ? (
                  <p className="text-[13px] text-text-secondary">No medicines mentioned.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {editor.medicines.map((medicine, index) => (
                      <li key={`${medicine.spokenName}-${index}`} className="rounded-lg border border-border px-2 py-1.5">
                        <input
                          className="h-8 w-full rounded-md border border-border px-2 text-sm text-text-primary"
                          value={medicine.name}
                          aria-label={`Medicine ${index + 1}`}
                          onChange={(event) => updateMedicine(index, { name: event.target.value })}
                        />
                        <p className="mt-1 text-[11px] text-text-secondary">
                          {medicineNotes(medicine) || "No dose stated"}
                          {medicine.matched ? "" : " · Not in catalog"}
                          {medicine.uncertain ? " · Check" : ""}
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-[11px] font-medium text-critical"
                          onClick={() =>
                            setEditor({
                              ...editor,
                              medicines: editor.medicines.filter((_, item) => item !== index),
                            })
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-text-secondary">
            Apply fills the assessment. The pharmacy receives the medicines only when you approve.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={compactPrimaryButtonClass} disabled={Boolean(busy)} onClick={() => void applyDraft()}>
              {busy === "apply" ? "Applying…" : "Apply to assessment"}
            </button>
            <button type="button" className={compactButtonClass} disabled={Boolean(busy)} onClick={() => void draftNote()}>
              {busy === "draft" ? "Drafting…" : "Draft again"}
            </button>
            {session?.status !== "APPLIED" ? (
              <button type="button" className={compactButtonClass} disabled={Boolean(busy)} onClick={() => void discard()}>
                Discard
              </button>
            ) : (
              <button type="button" className={compactButtonClass} disabled={Boolean(busy) || !consent} onClick={() => void startRecording()}>
                Record again
              </button>
            )}
          </div>
          {session?.status === "APPLIED" ? (
            <label className="flex items-start gap-2 text-[12px] text-text-secondary">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>Patient has agreed to record again</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-critical">{error}</p> : null}
    </section>
  );
}

function draftFieldValue(draft: ScribeDraft, key: ScribeAssessmentKey) {
  if (key === "chiefComplaint") return draft.chiefComplaint;
  if (key === "examination") return draft.examination;
  if (key === "diagnosis") return draft.diagnoses.join(", ");
  if (key === "summary") return draft.history;
  if (key === "advice") return draft.advice;
  return "";
}

function setDraftField(draft: ScribeDraft, key: ScribeAssessmentKey, value: string): ScribeDraft {
  if (key === "chiefComplaint") return { ...draft, chiefComplaint: value };
  if (key === "examination") return { ...draft, examination: value };
  if (key === "diagnosis") return { ...draft, diagnoses: value.trim() ? [value] : [] };
  if (key === "summary") return { ...draft, history: value };
  if (key === "advice") return { ...draft, advice: value };
  return draft;
}

function DraftReadout({ draft }: { draft: ScribeDraft | null }) {
  if (!draft) return <p className="text-[13px] text-text-secondary">No draft yet.</p>;
  const values = draftToAssessment(draft);
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-semibold text-text-primary">AI draft</p>
      {SCRIBE_ASSESSMENT_KEYS.map((key) =>
        values[key].trim() ? (
          <p key={key} className="text-[13px] text-text-primary">
            <span className="font-medium">{FIELD_LABELS[key]} · </span>
            {key === "visitOutcome" ? outcomeLabel(values[key]) : values[key]}
          </p>
        ) : null,
      )}
    </div>
  );
}

function outcomeLabel(value: string) {
  if (value === "DISCHARGE") return "Discharged";
  if (value === "FOLLOW_UP") return "Follow up";
  return value;
}

function includedFields(draft: ScribeDraft) {
  const values = draftToAssessment(draft);
  const next: Partial<Record<ScribeAssessmentKey, boolean>> = {};
  for (const key of SCRIBE_ASSESSMENT_KEYS) next[key] = Boolean(values[key].trim());
  return next;
}
