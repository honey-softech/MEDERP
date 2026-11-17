"use client";

import { useEffect, useState } from "react";
import { compactButtonClass, compactPrimaryButtonClass } from "@/components/auth-shell";
import { ConsultScribeDialog } from "@/components/consult-scribe-dialog";
import { useScribeCapture, type ScribeSessionView } from "@/components/use-scribe-capture";
import {
  SCRIBE_ASSESSMENT_KEYS,
  draftToAssessment,
  fieldsToCheck,
  medicineChoicesFromDraft,
  missingLabels,
  type ScribeAssessmentKey,
  type ScribeAssessmentPatch,
  type ScribeDraft,
  type ScribeFillMode,
} from "@/lib/scribe/draft-schema";

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

export function ConsultScribe({
  appointmentId,
  mode = "edit",
  placement = "card",
  onApply,
}: {
  appointmentId: string;
  mode?: "edit" | "view";
  placement?: "card" | "inline";
  onApply?: (
    patch: ScribeAssessmentPatch,
    uncertain: ScribeAssessmentKey[],
    choices?: Record<string, string[]>,
    mode?: ScribeFillMode,
  ) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [session, setSession] = useState<ScribeSessionView | null>(null);
  const [consent, setConsent] = useState(false);
  const [cardError, setCardError] = useState("");
  const [busy, setBusy] = useState("");

  const capture = useScribeCapture({
    appointmentId,
    onSession: (next) => {
      setSession(next);
      if (!next) setConsent(false);
    },
    onApply,
  });

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/appointments/${appointmentId}/scribe/session`)
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          configured?: boolean;
          session?: ScribeSessionView | null;
        };
        if (cancelled) return;
        if (response.status === 403) {
          setHidden(true);
          return;
        }
        if (!response.ok) {
          if (mode === "edit") setCardError(data.error ?? "Could not load the scribe.");
          return;
        }
        setConfigured(data.configured !== false);
        if (data.session) setSession(data.session);
      })
      .catch(() => {
        if (!cancelled && mode === "edit") setCardError("Could not load the scribe.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, mode]);

  async function discard() {
    if (!session) return;
    setBusy("discard");
    setCardError("");
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discard", sessionId: session.id }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setCardError(data.error ?? "Could not discard the recording.");
        return;
      }
      setSession(null);
      setConsent(false);
    } finally {
      setBusy("");
    }
  }

  async function fillAgain() {
    if (!session) return;
    setBusy("draft");
    setCardError("");
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/scribe/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; session?: ScribeSessionView };
      if (!response.ok || !data.session?.draft) {
        setCardError(data.error ?? "Could not draft the visit note.");
        return;
      }
      const values = draftToAssessment(data.session.draft);
      const patch: ScribeAssessmentPatch = {};
      for (const key of SCRIBE_ASSESSMENT_KEYS) {
        if (values[key].trim()) patch[key] = values[key];
      }
      if (Object.keys(patch).length === 0) {
        setSession(data.session);
        setCardError("Nothing clear was heard. Say the complaint, then each medicine with the dose.");
        return;
      }
      const applied = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "applied", sessionId: session.id, draft: data.session.draft }),
      });
      const appliedData = (await applied.json().catch(() => ({}))) as { error?: string; session?: ScribeSessionView };
      if (!applied.ok || !appliedData.session) {
        setSession(data.session);
        setCardError(appliedData.error ?? "Could not fill the assessment.");
        return;
      }
      setSession(appliedData.session);
      onApply?.(patch, fieldsToCheck(data.session.draft), medicineChoicesFromDraft(data.session.draft));
    } catch (reason) {
      setCardError(reason instanceof Error ? reason.message : "Could not draft the visit note.");
    } finally {
      setBusy("");
    }
  }

  if (hidden || (mode === "view" && (loading || !session || (!session.transcript && !session.translation && !session.draft)))) {
    return null;
  }

  if (placement === "inline") {
    const recording = capture.open || capture.machine === "live" || capture.machine === "paused" || capture.machine === "requesting" || capture.filling;
    return (
      <>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-dark"
          onClick={capture.present}
        >
          {recording ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
          {capture.filling ? "Filling…" : recording ? "Recording" : "Record"}
        </button>
        <ConsultScribeDialog capture={capture} />
      </>
    );
  }

  const openRecording = session?.status === "RECORDING" || session?.status === "TRANSCRIBED";
  const filled = session?.status === "APPLIED" || session?.status === "DRAFTED";
  const missing = missingLabels(session?.draft?.missingFields ?? []);

  return (
    <section className="print:hidden max-h-[46vh] shrink-0 overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-text-primary">AI scribe</h3>
        {session?.status === "APPLIED" && !capture.open ? (
          <p className="text-[11px] text-text-secondary">Applied. Approve the assessment when the note is correct.</p>
        ) : null}
      </div>

      {loading ? <p className="mt-2 text-xs text-text-secondary">Loading scribe…</p> : null}

      {!loading && mode === "view" && session ? (
        <div className="mt-2 space-y-3">
          <NoteText title="English" text={session.translation} empty="No translation yet." />
          <NoteText title="Recorded conversation" text={session.transcript} empty="No transcript yet." />
          <DraftReadout draft={session.draft} />
        </div>
      ) : null}

      {!loading && mode === "edit" && !configured && !session ? (
        <p className="mt-2 text-[13px] text-text-secondary">AI scribe is on for this hospital, but the server has no OpenAI API key.</p>
      ) : null}

      {!loading && mode === "edit" && !capture.open && !session && configured ? (
        <div className="mt-2 space-y-2">
          <p className="text-[13px] text-text-secondary">
            Say the complaint, how long, examination, diagnosis, each medicine with its dose, advice, then when to come back. The note is written into this assessment. Nothing reaches the pharmacy until you approve.
          </p>
          <label className="flex items-start gap-2 text-[13px] text-text-primary">
            <input type="checkbox" className="mt-0.5" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>Patient has agreed to this conversation being recorded</span>
          </label>
          <button type="button" className={compactPrimaryButtonClass} disabled={!consent} onClick={capture.start}>
            Start
          </button>
        </div>
      ) : null}

      {!loading && mode === "edit" && !capture.open && openRecording && !filled ? (
        <div className="mt-2 space-y-2">
          <NoteText title="English" text={session?.translation ?? ""} empty="No translation yet." />
          <button type="button" className={compactPrimaryButtonClass} onClick={capture.start}>
            Continue
          </button>
          <button type="button" className={compactButtonClass} disabled={Boolean(busy)} onClick={() => void discard()}>
            {busy === "discard" ? "Discarding…" : "Discard"}
          </button>
        </div>
      ) : null}

      {!loading && mode === "edit" && !capture.open && filled && session ? (
        <div className="mt-2 space-y-2">
          <NoteText title="English" text={session.translation} empty="No translation yet." />
          <p className="text-[13px] text-text-secondary">
            Filled the assessment below. Check those fields, then Approve. The pharmacy is updated only when you approve.
          </p>
          {missing.length > 0 ? <p className="text-[13px] text-text-primary">Still to ask: {missing.join(", ")}.</p> : null}
          {session.status === "DRAFTED" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={compactPrimaryButtonClass} disabled={Boolean(busy)} onClick={() => void fillAgain()}>
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
              {!consent ? <p className="text-[13px] text-text-primary">Tick the agreement, then Record again.</p> : null}
              <button type="button" className={compactButtonClass} disabled={!consent} onClick={capture.start}>
                Record again
              </button>
            </div>
          )}
        </div>
      ) : null}

      {capture.open ? <p className="mt-2 text-[13px] text-text-secondary">Recording is open in the window.</p> : null}
      {cardError ? <p className="mt-2 text-sm text-critical">{cardError}</p> : null}
      {mode === "edit" ? <ConsultScribeDialog capture={capture} /> : null}
    </section>
  );
}

function NoteText({ title, text, empty }: { title: string; text: string; empty: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-text-primary">{title}</p>
      <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-app-bg px-2.5 py-2 text-[13px] text-text-primary">
        {text.trim() || empty}
      </div>
    </div>
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
