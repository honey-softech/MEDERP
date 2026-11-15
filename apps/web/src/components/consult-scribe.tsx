"use client";

import { useEffect, useRef, useState } from "react";
import { compactButtonClass, compactPrimaryButtonClass } from "@/components/auth-shell";
import {
  SCRIBE_ASSESSMENT_KEYS,
  draftToAssessment,
  fieldsToCheck,
  medicineChoicesFromDraft,
  missingLabels,
  type ScribeAssessmentKey,
  type ScribeAssessmentPatch,
  type ScribeDraft,
} from "@/lib/scribe/draft-schema";
import { openInstalledSettings, runningInInstalledApp } from "@/lib/native-app-session";
import { SCRIBE_MAX_RECORDING_MS } from "@/lib/scribe/limits";
import {
  isSpeechLevel,
  recordingLimitReached,
  rmsFromSamples,
  silencePromptDue,
  silencePromptExpired,
} from "@/lib/scribe/recording-guard";

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
  if (error instanceof Error && error.message.startsWith("This browser")) return error.message;
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return runningInInstalledApp()
      ? "The microphone is off for MedERP. Turn it on in Settings, then record again."
      : "Allow the microphone to record the consultation.";
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
  onApply?: (patch: ScribeAssessmentPatch, uncertain: ScribeAssessmentKey[], choices?: Record<string, string[]>) => void;
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
  const [missing, setMissing] = useState<string[]>([]);
  const [silenceAsk, setSilenceAsk] = useState(false);

  const recordingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const partsRef = useRef<Blob[]>([]);
  const mimeRef = useRef("audio/webm");
  const sessionIdRef = useRef<string | null>(null);
  const seqRef = useRef(1);
  const uploadChainRef = useRef(Promise.resolve());
  const failedBlobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const silenceAskedAtRef = useRef(0);
  const silenceAskRef = useRef(false);
  const draftingRef = useRef(false);
  const stopAndFillRef = useRef<() => void>(() => {});

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
          setMissing(missingLabels(data.session.draft?.missingFields ?? []));
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
    startedAtRef.current = started;
    lastSpeechAtRef.current = started;
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - started;
      setElapsed(elapsedMs);
      if (draftingRef.current || !recordingRef.current) return;
      if (recordingLimitReached(elapsedMs)) {
        setSilenceAsk(false);
        silenceAskRef.current = false;
        stopAndFillRef.current();
        return;
      }
      if (silenceAskRef.current) {
        if (silencePromptExpired(now - silenceAskedAtRef.current)) {
          setSilenceAsk(false);
          silenceAskRef.current = false;
          stopAndFillRef.current();
        }
        return;
      }
      const analyser = analyserRef.current;
      if (analyser) {
        const samples = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(samples);
        if (isSpeechLevel(rmsFromSamples(samples))) lastSpeechAtRef.current = now;
      }
      if (runningInInstalledApp()) return;
      if (silencePromptDue(now - lastSpeechAtRef.current, false)) {
        silenceAskRef.current = true;
        silenceAskedAtRef.current = now;
        setSilenceAsk(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => {
    stopAndFillRef.current = () => {
      void draftNote();
    };
  });

  useEffect(() => {
    return () => {
      recordingRef.current = false;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
    };
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    const audio = audioContextRef.current;
    audioContextRef.current = null;
    void audio?.close();
  }

  async function releaseCapture() {
    recordingRef.current = false;
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });
    }
    stopTracks();
  }

  function remember(next: SessionView) {
    setSession(next);
    setTranscript(next.transcript ?? "");
    setTranslation(next.translation ?? "");
    sessionIdRef.current = next.id;
    seqRef.current = (next.chunkCount ?? 0) + 1;
    setMissing(missingLabels(next.draft?.missingFields ?? []));
  }

  async function sendChunk(blob: Blob) {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const seq = seqRef.current;
    const body = new FormData();
    body.set("audio", blob, "consult.webm");
    body.set("sessionId", sessionId);
    body.set("seq", String(seq));
    body.set("mode", "replace");
    body.set("durationMs", String(Math.max(0, Date.now() - startedAtRef.current)));
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

  function enqueue(blob: Blob, final = false) {
    uploadChainRef.current = uploadChainRef.current
      .catch(() => undefined)
      .then(() => sendChunk(blob))
      .catch((reason: unknown) => {
        const message = reason instanceof Error ? reason.message : "Could not save that part of the conversation.";
        if (!final && recordingRef.current) {
          setError(message);
          return;
        }
        recordingRef.current = false;
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        setLive(false);
        setError(message);
        throw reason;
      });
  }

  function currentRecording() {
    return new Blob(partsRef.current, { type: mimeRef.current || "audio/webm" });
  }

  function startSegment() {
    const stream = streamRef.current;
    if (!stream || !recordingRef.current) return;
    const mime = recorderMime();
    partsRef.current = [];
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
    mimeRef.current = rec.mimeType || mime || "audio/webm";
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) partsRef.current.push(event.data);
    };
    rec.onstop = () => {
      const blob = currentRecording();
      if (blob.size > 0) enqueue(blob, true);
    };
    try {
      // A timed slice of an iOS mp4 recording can kill the web view.
      rec.start();
    } catch {
      setError("Could not start recording.");
      recordingRef.current = false;
      setLive(false);
      stopTracks();
    }
  }

  function openMicrophone() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return Promise.reject(new Error("This browser cannot record audio. Use Chrome or Edge."));
    }
    // Called from the tap, before any await. iOS only shows the microphone
    // alert when getUserMedia starts inside that tap.
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }

  async function beginStream(existing?: MediaStream) {
    if (!existing && (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia)) {
      setError("This browser cannot record audio. Use Chrome or Edge.");
      return false;
    }
    try {
      streamRef.current = existing ?? (await openMicrophone());
    } catch (reason) {
      setError(micMessage(reason));
      return false;
    }
    recordingRef.current = true;
    silenceAskRef.current = false;
    setSilenceAsk(false);
    startedAtRef.current = Date.now();
    lastSpeechAtRef.current = startedAtRef.current;
    setLive(true);
    setElapsed(0);
    // The installed app records with MediaRecorder only. An AudioContext on the
    // same capture stream makes WKWebView quit.
    if (!runningInInstalledApp()) {
      try {
        const audioWindow = window.AudioContext;
        if (audioWindow) {
          const audio = new audioWindow();
          const source = audio.createMediaStreamSource(streamRef.current);
          const analyser = audio.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          audioContextRef.current = audio;
          analyserRef.current = analyser;
          void audio.resume();
        }
      } catch {
        // Recording continues when the silence meter cannot start.
      }
    }
    startSegment();
    return true;
  }

  async function startRecording() {
    setError("");
    setBusy("start");
    const micReady = openMicrophone().then(
      (stream) => stream,
      (reason: unknown) => reason,
    );
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", consent: true }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; session?: SessionView };
      const mic = await micReady;
      if (!response.ok || !data.session) {
        if (mic instanceof MediaStream) mic.getTracks().forEach((track) => track.stop());
        setError(data.error ?? "Could not start the recording.");
        return;
      }
      remember(data.session);
      if (!(mic instanceof MediaStream)) {
        setError(micMessage(mic));
        return;
      }
      await beginStream(mic);
    } catch (reason) {
      const mic = await micReady;
      if (mic instanceof MediaStream) mic.getTracks().forEach((track) => track.stop());
      setError(reason instanceof Error ? reason.message : "Could not start the recording.");
    } finally {
      setBusy("");
    }
  }

  async function continueRecording() {
    setError("");
    await releaseCapture();
    await beginStream();
  }

  async function finishUploads() {
    recordingRef.current = false;
    silenceAskRef.current = false;
    setSilenceAsk(false);
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
    if (!sessionId || draftingRef.current) return;
    draftingRef.current = true;
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
      const draft = data.session.draft;
      if (!draft) {
        setError("Nothing clear was heard. Say the complaint, then each medicine with the dose.");
        return;
      }
      const values = draftToAssessment(draft);
      const patch: ScribeAssessmentPatch = {};
      for (const key of SCRIBE_ASSESSMENT_KEYS) {
        if (values[key].trim()) patch[key] = values[key];
      }
      if (Object.keys(patch).length === 0) {
        setError("Nothing clear was heard. Say the complaint, then each medicine with the dose.");
        setMissing(missingLabels(draft.missingFields ?? []));
        return;
      }
      const applied = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "applied", sessionId, draft }),
      });
      const appliedData = (await applied.json().catch(() => ({}))) as { error?: string; session?: SessionView };
      if (!applied.ok || !appliedData.session) {
        setError(appliedData.error ?? "Could not fill the assessment.");
        return;
      }
      remember(appliedData.session);
      onApply?.(patch, fieldsToCheck(draft), medicineChoicesFromDraft(draft));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not draft the visit note.");
    } finally {
      draftingRef.current = false;
      setBusy("");
    }
  }

  function continueAfterSilence() {
    silenceAskRef.current = false;
    silenceAskedAtRef.current = 0;
    lastSpeechAtRef.current = Date.now();
    setSilenceAsk(false);
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
      setMissing([]);
      setTranscript("");
      setTranslation("");
      sessionIdRef.current = null;
      seqRef.current = 1;
      setConsent(false);
    } finally {
      setBusy("");
    }
  }

  if (hidden || (mode === "view" && (loading || !session || (!session.transcript && !session.translation && !session.draft)))) {
    return null;
  }

  const openRecording = session?.status === "RECORDING" || session?.status === "TRANSCRIBED";
  const filled = !live && (session?.status === "APPLIED" || session?.status === "DRAFTED");

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
        <p className="text-[13px] font-semibold text-text-primary">English</p>
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
            Say these in order: complaint, how long, examination, diagnosis, then each medicine on its own: மருந்து, the name, the strength, காலை or மதியம் or இரவு, சாப்பாட்டுக்கு முன் or பின், and how many days. Then advice, then when to come back. The note is written into this assessment. Nothing reaches the pharmacy until you approve.
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

      {!loading && mode === "edit" && session && (live || openRecording) && !filled ? (
        <div className="mt-2 space-y-2">
          {live ? (
            <p className="text-[13px] text-text-secondary">Recording. Press Stop when finished.</p>
          ) : (
            liveText
          )}
          {live && elapsed >= SCRIBE_MAX_RECORDING_MS - 60_000 ? (
            <p className="text-[12px] font-medium text-text-primary">
              Stops in {formatElapsed(Math.max(0, SCRIBE_MAX_RECORDING_MS - elapsed))}
            </p>
          ) : null}
          <p className="text-[12px] text-text-secondary">
            For each tablet say: மருந்து, name, strength, காலை or மதியம் or இரவு, சாப்பாட்டுக்கு முன் or பின், and the number of days.
          </p>
          {silenceAsk ? (
            <div className="space-y-2 rounded-lg border border-border bg-app-bg px-2.5 py-2">
              <p className="text-[13px] text-text-primary">No speech for 1 minute. Continue recording or Stop?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={compactPrimaryButtonClass} disabled={Boolean(busy)} onClick={continueAfterSilence}>
                  Continue
                </button>
                <button type="button" className={compactButtonClass} disabled={Boolean(busy)} onClick={() => void draftNote()}>
                  {busy === "draft" ? "Filling the assessment…" : "Stop"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {live ? (
              <button type="button" className={compactPrimaryButtonClass} disabled={Boolean(busy)} onClick={() => void draftNote()}>
                {busy === "draft" ? "Filling the assessment…" : "Stop and fill assessment"}
              </button>
            ) : (
              <>
                <button type="button" className={compactPrimaryButtonClass} disabled={Boolean(busy)} onClick={() => void continueRecording()}>
                  Continue
                </button>
                <button type="button" className={compactButtonClass} disabled={Boolean(busy)} onClick={() => void draftNote()}>
                  {busy === "draft" ? "Filling the assessment…" : "Fill assessment"}
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

      {!loading && mode === "edit" && filled ? (
        <div className="mt-2 space-y-2">
          {liveText}
          <p className="text-[13px] text-text-secondary">
            Filled the assessment below. Check those fields, then Approve. The pharmacy is updated only when you approve.
          </p>
          {missing.length > 0 ? (
            <p className="text-[13px] text-text-primary">Still to ask: {missing.join(", ")}.</p>
          ) : null}
          {session?.status === "DRAFTED" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={compactPrimaryButtonClass} disabled={Boolean(busy)} onClick={() => void draftNote()}>
                {busy === "draft" ? "Filling the assessment…" : "Fill assessment"}
              </button>
              <button type="button" className={compactButtonClass} disabled={Boolean(busy)} onClick={() => void discard()}>
                Discard
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-[12px] text-text-secondary">
                <input type="checkbox" className="mt-0.5" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                <span>Patient has agreed to record again</span>
              </label>
              {!consent ? (
                <p className="text-[13px] text-text-primary">Tick the agreement, then Record again.</p>
              ) : null}
              <button type="button" className={compactButtonClass} disabled={Boolean(busy) || !consent} onClick={() => void startRecording()}>
                {busy === "start" ? "Starting…" : "Record again"}
              </button>
              {error ? <p className="text-sm text-critical">{error}</p> : null}
              {error && runningInInstalledApp() ? (
                <button type="button" className={compactButtonClass} onClick={openInstalledSettings}>
                  Open Settings
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-critical">{error}</p> : null}
    </section>
  );
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
