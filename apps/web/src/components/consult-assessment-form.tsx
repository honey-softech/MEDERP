"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BloodTestPicker } from "@/components/blood-test-picker";
import { PrescriptionBuilder } from "@/components/prescription-builder";
import { ExpandToggle } from "@/components/expand-toggle";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import type { InvestigationPick } from "@/lib/lab-catalog";

export type AssessmentValues = {
  chiefComplaint: string;
  examination: string;
  diagnosis: string;
  summary: string;
  prescription: string;
  advice: string;
  followUpAt: string;
  visitOutcome: string;
};

const COMPLAINT_SUGGESTIONS = [
  "Fever",
  "Cough",
  "Cold",
  "Headache",
  "Body pain",
  "Stomach pain",
  "Breathing problem",
  "Weakness",
  "Vomiting",
  "Diarrhoea",
];

const FOLLOW_UP_QUICK = [
  { label: "3d", days: 3 },
  { label: "1w", days: 7 },
  { label: "2w", days: 14 },
  { label: "1m", days: 30 },
] as const;

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function parseChips(raw: string) {
  return raw
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function chipsToText(chips: string[]) {
  return chips.join(", ");
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function serializeDraft(values: AssessmentValues, investigations: InvestigationPick[]) {
  return JSON.stringify({ values, investigations });
}

export function ConsultAssessmentForm({
  appointmentId,
  initial,
  canPreview = false,
  initialTestIds = [],
  initialInvestigations,
  testsLocked = false,
  alreadyApproved = false,
  labEnabled = true,
  patientPhone = null,
  awaitingOutsideReport = false,
  outsideReportReady = false,
  priorOrderCount = 0,
  visitReason = "",
  cockpit = false,
  children,
}: {
  appointmentId: string;
  initial?: Partial<AssessmentValues> & { followUpAt?: string | Date | null };
  canPreview?: boolean;
  initialTestIds?: string[];
  initialInvestigations?: InvestigationPick[];
  testsLocked?: boolean;
  alreadyApproved?: boolean;
  labEnabled?: boolean;
  patientPhone?: string | null;
  awaitingOutsideReport?: boolean;
  outsideReportReady?: boolean;
  priorOrderCount?: number;
  visitReason?: string;
  cockpit?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState<AssessmentValues>({
    chiefComplaint: initial?.chiefComplaint ?? "",
    examination: initial?.examination ?? "",
    diagnosis: initial?.diagnosis ?? "",
    summary: initial?.summary ?? "",
    prescription: initial?.prescription ?? "",
    advice: initial?.advice ?? "",
    followUpAt: toDateInput(initial?.followUpAt),
    visitOutcome: initial?.visitOutcome === "DISCHARGE" || initial?.visitOutcome === "FOLLOW_UP"
      ? initial.visitOutcome
      : initial?.followUpAt
        ? "FOLLOW_UP"
        : "",
  });
  const [complaintDraft, setComplaintDraft] = useState("");
  const [examOpen, setExamOpen] = useState(Boolean(initial?.examination?.trim()));
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [investigations, setInvestigations] = useState<InvestigationPick[]>(
    initialInvestigations ?? initialTestIds.map((testId) => ({ testId })),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [saved, setSaved] = useState(canPreview);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">(
    canPreview ? "saved" : "idle",
  );

  const valuesRef = useRef(values);
  const investigationsRef = useRef(investigations);
  const lastSavedRef = useRef(serializeDraft(values, investigations));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const mountedRef = useRef(true);
  const inFlightSaveRef = useRef<Promise<boolean> | null>(null);
  valuesRef.current = values;
  investigationsRef.current = investigations;

  const complaintChips = useMemo(() => parseChips(values.chiefComplaint), [values.chiefComplaint]);

  function setField<K extends keyof AssessmentValues>(key: K, value: AssessmentValues[K]) {
    setConfirmApprove(false);
    setValues((current) => ({ ...current, [key]: value }));
  }

  function addComplaint(raw: string) {
    const label = raw.trim();
    if (!label) return;
    const next = [...complaintChips];
    if (!next.some((item) => item.toLowerCase() === label.toLowerCase())) {
      next.push(label);
      setField("chiefComplaint", chipsToText(next));
    }
    setComplaintDraft("");
  }

  function removeComplaint(label: string) {
    setField(
      "chiefComplaint",
      chipsToText(complaintChips.filter((item) => item.toLowerCase() !== label.toLowerCase())),
    );
  }

  function setOutcome(outcome: "FOLLOW_UP" | "DISCHARGE") {
    setField("visitOutcome", outcome);
    if (outcome === "DISCHARGE") {
      setField("followUpAt", "");
    } else if (!values.followUpAt) {
      setField("followUpAt", addDaysIso(7));
    }
  }

  async function persist(action: "save" | "approve") {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (action === "approve" && inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }

    const snapshotValues = valuesRef.current;
    const snapshotInvestigations = investigationsRef.current;
    const snapshot = serializeDraft(snapshotValues, snapshotInvestigations);
    if (action === "save" && snapshot === lastSavedRef.current) return true;

    const seq = ++saveSeqRef.current;
    if (action === "save") {
      setDraftStatus("saving");
    } else {
      setConfirmApprove(false);
      setError("");
      setPending("approve");
    }

    const run = (async () => {
      const response = await fetch(`/api/appointments/${appointmentId}/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...snapshotValues, investigations: snapshotInvestigations }),
        keepalive: action === "save",
      });
      const raw = await response.text();
      let data: { error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: "Could not save the visit summary." };
      }

      if (action === "save" && seq !== saveSeqRef.current) return false;
      if (!mountedRef.current) return response.ok;

      if (!response.ok) {
        const message = data.error ?? "Could not save the visit summary.";
        if (action === "save") {
          setDraftStatus("error");
          setError(message);
        } else {
          setPending("");
          setError(message);
        }
        return false;
      }

      lastSavedRef.current = snapshot;
      setSaved(true);
      setError("");
      if (action === "save") {
        setDraftStatus("saved");
        const latest = serializeDraft(valuesRef.current, investigationsRef.current);
        if (latest !== snapshot) scheduleDraftSave();
        return true;
      }

      setPending("");
      router.push(`/appointments/${appointmentId}/summary`);
      router.refresh();
      return true;
    })();

    if (action === "save") {
      inFlightSaveRef.current = run;
      try {
        return await run;
      } finally {
        if (inFlightSaveRef.current === run) inFlightSaveRef.current = null;
      }
    }

    return run;
  }

  function scheduleDraftSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persist("save");
    }, 900);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const snapshot = serializeDraft(values, investigations);
    if (snapshot === lastSavedRef.current) return;
    setDraftStatus("saving");
    scheduleDraftSave();
  }, [values, investigations]);

  useEffect(() => {
    function flush() {
      const snapshot = serializeDraft(valuesRef.current, investigationsRef.current);
      if (snapshot === lastSavedRef.current) return;
      void persist("save");
    }
    function onHide() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [appointmentId]);

  const findings = (
    <div className="space-y-2.5">
      {visitReason ? (
        <div className="rounded-lg border border-border bg-app-bg px-3 py-1.5 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">Booking notes · </span>
          {visitReason}
        </div>
      ) : null}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary">Chief complaints</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {complaintChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => removeComplaint(chip)}
              className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary-dark"
              title="Remove"
            >
              {chip}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className={fieldClass}
            value={complaintDraft}
            placeholder="Add complaint and press Enter"
            onChange={(event) => setComplaintDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addComplaint(complaintDraft);
              }
            }}
          />
          <button type="button" className={secondaryButtonClass} onClick={() => addComplaint(complaintDraft)}>
            Add
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {COMPLAINT_SUGGESTIONS.filter(
            (item) => !complaintChips.some((chip) => chip.toLowerCase() === item.toLowerCase()),
          ).map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary hover:bg-app-bg"
              onClick={() => addComplaint(item)}
            >
              + {item}
            </button>
          ))}
        </div>
      </div>

      <BloodTestPicker
        compact={cockpit}
        selectedInvestigations={investigations}
        onInvestigationsChange={setInvestigations}
        locked={testsLocked}
        labEnabled={labEnabled}
        patientPhone={patientPhone}
        priorOrderCount={priorOrderCount}
        printHref={`/appointments/${appointmentId}/investigations`}
      />

      <Area
        label="Clinical notes"
        value={values.summary}
        onChange={(v) => setField("summary", v)}
        rows={3}
      />

      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-sm font-medium text-text-primary">Examination</p>
          <ExpandToggle open={examOpen} onToggle={() => setExamOpen((v) => !v)} />
        </div>
        {examOpen ? (
          <div className="border-t border-border px-3 pb-3">
            <textarea
              className={fieldClass}
              rows={4}
              value={values.examination}
              onChange={(event) => setField("examination", event.target.value)}
              placeholder="General exam, systemic findings…"
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  const plan = (
    <div className="space-y-3">
      <Field label="Diagnosis" value={values.diagnosis} onChange={(v) => setField("diagnosis", v)} />
      <PrescriptionBuilder value={values.prescription} onChange={(v) => setField("prescription", v)} />

      <div>
        <p className="mb-1.5 text-sm font-semibold text-text-primary">Outcome</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              values.visitOutcome === "FOLLOW_UP"
                ? "border-primary bg-primary-light text-primary-dark"
                : "border-border text-text-secondary hover:bg-app-bg"
            }`}
            onClick={() => setOutcome("FOLLOW_UP")}
          >
            Follow up
          </button>
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              values.visitOutcome === "DISCHARGE"
                ? "border-primary bg-primary-light text-primary-dark"
                : "border-border text-text-secondary hover:bg-app-bg"
            }`}
            onClick={() => setOutcome("DISCHARGE")}
          >
            Discharge
          </button>
        </div>
      </div>

      {values.visitOutcome !== "DISCHARGE" ? (
        <div>
          <label className="text-sm font-medium text-slate-700">
            Follow-up date
            <input
              className={fieldClass}
              type="date"
              value={values.followUpAt}
              onChange={(event) => {
                setField("followUpAt", event.target.value);
                if (event.target.value) setField("visitOutcome", "FOLLOW_UP");
              }}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-1">
            {FOLLOW_UP_QUICK.map((item) => (
              <button
                key={item.label}
                type="button"
                className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary hover:bg-app-bg"
                onClick={() => {
                  setField("followUpAt", addDaysIso(item.days));
                  setField("visitOutcome", "FOLLOW_UP");
                }}
              >
                +{item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Area label="Advice" value={values.advice} onChange={(v) => setField("advice", v)} rows={2} />
    </div>
  );

  const actions = (
    <div className={cockpit ? "mt-3 space-y-2 border-t border-border pt-3" : "flex flex-wrap items-center gap-3"}>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      {confirmApprove ? (
        <p className="text-xs text-text-secondary">
          This publishes the visit summary. Tap Approve again to confirm.{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setConfirmApprove(false)}
          >
            Cancel
          </button>
        </p>
      ) : null}
      <div className={cockpit ? "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" : "contents"}>
        <p className="text-xs text-text-secondary">
          {draftStatus === "saving"
            ? "Saving…"
            : draftStatus === "saved"
              ? "Draft saved"
              : draftStatus === "error"
                ? "Could not auto-save"
                : "Draft saves automatically"}
        </p>
        <button
          className={`${primaryButtonClass} shrink-0 ${cockpit ? "w-full sm:w-auto sm:min-w-[8.5rem]" : ""} ${
            confirmApprove ? "ring-2 ring-primary/30 ring-offset-2" : ""
          }`}
          type="button"
          disabled={Boolean(pending)}
          onClick={() => {
            if (!confirmApprove) {
              setConfirmApprove(true);
              return;
            }
            void persist("approve");
          }}
        >
          {pending === "approve"
            ? alreadyApproved
              ? "Publishing…"
              : "Approving…"
            : confirmApprove
              ? "Confirm approve"
              : alreadyApproved
                ? "Publish"
                : "Approve"}
        </button>
        {saved && !cockpit ? (
          <Link href={`/appointments/${appointmentId}/summary`} className={secondaryButtonClass}>
            Preview
          </Link>
        ) : null}
      </div>
    </div>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
      className={
        cockpit
          ? "grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2"
          : "grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      }
    >
      {!cockpit ? (
        <div>
          <h3 className="font-semibold">Doctor assessment</h3>
          <p className="mt-1 text-sm text-slate-500">Notes save automatically. Approve when the consult is complete.</p>
        </div>
      ) : null}

      <section
        className={
          cockpit
            ? "min-w-0 rounded-xl border border-border bg-surface p-3 shadow-card"
            : "space-y-3"
        }
      >
        {cockpit ? <h3 className="mb-2 text-sm font-semibold text-text-primary">Findings</h3> : null}
        {findings}
        {children ? <div className="mt-3 space-y-3">{children}</div> : null}
      </section>

      <section
        className={
          cockpit
            ? "min-w-0 rounded-xl border border-border bg-surface p-3 shadow-card"
            : "space-y-3"
        }
      >
        {cockpit ? <h3 className="mb-2 text-sm font-semibold text-text-primary">Plan</h3> : null}
        {plan}
        {actions}
      </section>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input className={fieldClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  className,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className={`text-sm font-medium text-slate-700 ${className ?? ""}`}>
      {label}
      <textarea className={fieldClass} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <span className="mt-1 block text-[11px] font-normal text-text-secondary">{hint}</span> : null}
    </label>
  );
}
