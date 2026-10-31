"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BloodTestPicker } from "@/components/blood-test-picker";
import { PrescriptionBuilder } from "@/components/prescription-builder";
import { ExpandToggle } from "@/components/expand-toggle";
import {
  fieldClass,
  textareaClass,
  compactFieldClass,
  compactTextareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth-shell";
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

export type PriorVisitReuse = {
  diagnosis?: string;
  prescription?: string;
  chiefComplaint?: string;
} | null;

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

const ADVICE_SUGGESTIONS = [
  "Rest",
  "Plenty of fluids",
  "Avoid oily / spicy food",
  "Complete full course",
  "Review if symptoms worsen",
];

const NORMAL_EXAM =
  "CVS: S1S2 normal. RS: Clear, no added sounds. P/A: Soft, non-tender. CNS: Conscious, oriented.";

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
  priorVisit = null,
  cockpit = false,
  followUpReminderNote = null,
  testsMountId = null,
  ordersPanel = null,
  allergies = null,
  currentMedications = null,
  nextAppointmentId = null,
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
  priorVisit?: PriorVisitReuse;
  cockpit?: boolean;
  followUpReminderNote?: string | null;
  /** When set (cockpit), Tests / scans render under the history column instead of Findings. */
  testsMountId?: string | null;
  /** Existing orders, shown inside the Tests / scans popup. */
  ordersPanel?: ReactNode;
  allergies?: string | null;
  currentMedications?: string | null;
  /** Next patient in today's queue. Ctrl/Cmd+Enter approves and opens this visit. */
  nextAppointmentId?: string | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const inputClass = cockpit ? compactFieldClass : fieldClass;
  const areaClass = cockpit ? compactTextareaClass : textareaClass;
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
  const [diagnosisDraft, setDiagnosisDraft] = useState("");
  const [diagnosisTouched, setDiagnosisTouched] = useState(false);
  const [approveAttempted, setApproveAttempted] = useState(false);
  const [approveAfterOutcome, setApproveAfterOutcome] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [investigations, setInvestigations] = useState<InvestigationPick[]>(
    initialInvestigations ?? initialTestIds.map((testId) => ({ testId })),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [saved, setSaved] = useState(canPreview);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">(
    canPreview ? "saved" : "idle",
  );
  const [testsMountEl, setTestsMountEl] = useState<HTMLElement | null>(null);
  const [frequent, setFrequent] = useState<{
    diagnoses: string[];
    complaints: string[];
    advice: string[];
  } | null>(null);
  const [rxTemplates, setRxTemplates] = useState<
    Array<{ id: string; name: string; diagnosis: string; prescription: string }>
  >([]);
  const [offeredTemplate, setOfferedTemplate] = useState<{
    id: string;
    name: string;
    diagnosis: string;
    prescription: string;
  } | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDiagnosis, setTemplateDiagnosis] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const diagnosisInputRef = useRef<HTMLInputElement>(null);
  const approveViaShortcutRef = useRef(false);
  const approveAfterOutcomeRef = useRef(false);

  useEffect(() => {
    if (!testsMountId || typeof document === "undefined") {
      setTestsMountEl(null);
      return;
    }
    const mq = window.matchMedia("(min-width: 640px)");
    function resolve() {
      const desktop = document.getElementById("visit-tests-mount");
      const mobile = document.getElementById("visit-tests-mount-mobile");
      // Prefer the visible mount — desktop node exists but is hidden below sm.
      setTestsMountEl(mq.matches ? desktop ?? mobile : mobile ?? desktop);
    }
    resolve();
    mq.addEventListener("change", resolve);
    return () => mq.removeEventListener("change", resolve);
  }, [testsMountId]);

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
  const diagnosisChips = useMemo(() => parseChips(values.diagnosis), [values.diagnosis]);

  const needsDiagnosis = !values.diagnosis.trim();
  const showDiagnosisError = needsDiagnosis && (diagnosisTouched || approveAttempted);

  const missingForApprove = useMemo(() => {
    const missing: string[] = [];
    if (needsDiagnosis) missing.push("diagnosis");
    return missing;
  }, [needsDiagnosis]);

  const requiredFieldClass = "border-critical bg-critical-bg/40 ring-1 ring-critical/40";

  function setField<K extends keyof AssessmentValues>(key: K, value: AssessmentValues[K]) {
    const next = { ...valuesRef.current, [key]: value };
    valuesRef.current = next;
    setValues(next);
  }

  function addChip(
    key: "chiefComplaint" | "diagnosis",
    raw: string,
    chips: string[],
    clearDraft?: (v: string) => void,
  ) {
    const label = raw.trim();
    if (!label) return;
    const next = [...chips];
    if (!next.some((item) => item.toLowerCase() === label.toLowerCase())) {
      next.push(label);
      setField(key, chipsToText(next));
    }
    clearDraft?.("");
  }

  function removeChip(key: "chiefComplaint" | "diagnosis", label: string, chips: string[]) {
    setField(
      key,
      chipsToText(chips.filter((item) => item.toLowerCase() !== label.toLowerCase())),
    );
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

    if (action === "approve") {
      if (!snapshotValues.diagnosis.trim()) {
        setApproveAttempted(true);
        setError("Add a diagnosis before approving.");
        diagnosisInputRef.current?.focus();
        diagnosisInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        return false;
      }
    }

    const seq = ++saveSeqRef.current;
    if (action === "save") {
      setDraftStatus("saving");
    } else {
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
      const nextVisit = approveViaShortcutRef.current ? nextAppointmentId : null;
      approveViaShortcutRef.current = false;
      router.push(nextVisit ? `/appointments/${nextVisit}` : `/appointments/${appointmentId}`);
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

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/doctors/me/frequent")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setFrequent({
          diagnoses: Array.isArray(data.diagnoses) ? data.diagnoses : [],
          complaints: Array.isArray(data.complaints) ? data.complaints : [],
          advice: Array.isArray(data.advice) ? data.advice : [],
        });
      })
      .catch(() => undefined);
    void fetch("/api/doctors/me/rx-templates")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.templates)) return;
        setRxTemplates(data.templates);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function offerTemplateFor(label: string) {
    const key = label.trim().toLowerCase();
    if (!key) return;
    const match = rxTemplates.find((template) => template.diagnosis.trim().toLowerCase() === key);
    if (match) setOfferedTemplate(match);
  }

  function requestApprove(fromShortcut = false) {
    approveViaShortcutRef.current = fromShortcut;
    if (!valuesRef.current.diagnosis.trim()) {
      setApproveAttempted(true);
      setError("Add a diagnosis before approving.");
      diagnosisInputRef.current?.focus();
      diagnosisInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (!valuesRef.current.visitOutcome) {
      approveAfterOutcomeRef.current = true;
      setApproveAfterOutcome(true);
      setFollowUpOpen(true);
      return;
    }
    void persist("approve");
  }

  const requestApproveRef = useRef(requestApprove);
  useEffect(() => {
    requestApproveRef.current = requestApprove;
  }, [requestApprove]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.altKey || event.shiftKey) return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      requestApproveRef.current(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function closeOutcome() {
    approveAfterOutcomeRef.current = false;
    setApproveAfterOutcome(false);
    approveViaShortcutRef.current = false;
    setFollowUpOpen(false);
  }

  function chooseFollowUp() {
    const current = valuesRef.current;
    const followUpAt = current.followUpAt || addDaysIso(7);
    const next = { ...current, visitOutcome: "FOLLOW_UP", followUpAt };
    valuesRef.current = next;
    setValues(next);
    if (!approveAfterOutcomeRef.current) return;
    approveAfterOutcomeRef.current = false;
    setApproveAfterOutcome(false);
    setFollowUpOpen(false);
    void persist("approve");
  }

  function chooseDischarge() {
    const next = { ...valuesRef.current, visitOutcome: "DISCHARGE", followUpAt: "" };
    valuesRef.current = next;
    setValues(next);
    const shouldApprove = approveAfterOutcomeRef.current;
    approveAfterOutcomeRef.current = false;
    setApproveAfterOutcome(false);
    setFollowUpOpen(false);
    if (shouldApprove) void persist("approve");
  }

  function confirmOutcome() {
    const shouldApprove = approveAfterOutcomeRef.current;
    const ready =
      valuesRef.current.visitOutcome === "DISCHARGE" ||
      (valuesRef.current.visitOutcome === "FOLLOW_UP" && Boolean(valuesRef.current.followUpAt));
    if (shouldApprove && !ready) return;
    approveAfterOutcomeRef.current = false;
    setApproveAfterOutcome(false);
    setFollowUpOpen(false);
    if (shouldApprove) void persist("approve");
  }

  async function saveRxTemplate() {
    const diagnosis = templateDiagnosis.trim();
    const prescription = valuesRef.current.prescription.trim();
    if (!diagnosis || !prescription) {
      setTemplateMessage("Add a diagnosis and a prescription first.");
      return;
    }
    setTemplateMessage("");
    const response = await fetch("/api/doctors/me/rx-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: templateName.trim() || diagnosis,
        diagnosis,
        prescription,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setTemplateMessage(data.error ?? "Could not save the template.");
      return;
    }
    if (data.template) {
      setRxTemplates((current) => [data.template, ...current.filter((row) => row.id !== data.template.id)]);
    }
    setTemplateOpen(false);
    setTemplateName("");
    setTemplateMessage("Saved. It will be offered the next time you pick this diagnosis.");
  }

  const complaintSuggestions = frequent?.complaints?.length ? frequent.complaints : COMPLAINT_SUGGESTIONS;
  const adviceSuggestions = frequent?.advice?.length ? frequent.advice : ADVICE_SUGGESTIONS;
  const diagnosisSuggestions = frequent?.diagnoses ?? [];

  const findings = (
    <div className="flex min-h-0 flex-1 flex-col space-y-2.5">
      {visitReason ? (
        <div className="rounded-lg border border-border bg-app-bg px-3 py-1.5 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">Booking notes · </span>
          {visitReason}
          {!complaintChips.length ? (
            <button
              type="button"
              className="ml-2 font-medium text-primary hover:underline"
              onClick={() => addChip("chiefComplaint", visitReason, complaintChips)}
            >
              Use as complaint
            </button>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-text-primary 2xl:text-sm">Chief complaints</p>
          {priorVisit?.chiefComplaint?.trim() && !values.chiefComplaint.trim() ? (
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline"
              onClick={() => setField("chiefComplaint", priorVisit.chiefComplaint!.trim())}
            >
              Same as last visit
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {complaintChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => removeChip("chiefComplaint", chip, complaintChips)}
              className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-[13px] font-medium text-primary-dark"
              title="Remove"
            >
              {chip}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex min-w-0 gap-2">
          <input
            className={`${inputClass} min-w-0`}
            value={complaintDraft}
            autoFocus
            placeholder="Add complaint and press Enter"
            onChange={(event) => setComplaintDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addChip("chiefComplaint", complaintDraft, complaintChips, setComplaintDraft);
              }
            }}
          />
          <button
            type="button"
            className={`${
              cockpit
                ? "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-primary hover:bg-app-bg 2xl:h-10 2xl:rounded-lg 2xl:px-4 2xl:text-sm"
                : secondaryButtonClass
            } shrink-0`}
            onClick={() => addChip("chiefComplaint", complaintDraft, complaintChips, setComplaintDraft)}
          >
            Add
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {complaintSuggestions
            .filter((item) => !complaintChips.some((chip) => chip.toLowerCase() === item.toLowerCase()))
            .map((item) => (
              <button
                key={item}
                type="button"
                tabIndex={-1}
                className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-app-bg"
                onClick={() => addChip("chiefComplaint", item, complaintChips)}
              >
                + {item}
              </button>
            ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-sm font-medium text-text-primary">Clinical notes</p>
          <div className="flex items-center gap-2">
            {!values.examination.trim() ? (
              <button
                type="button"
                className="text-[11px] font-medium text-primary hover:underline"
                onClick={() => {
                  setField("examination", NORMAL_EXAM);
                  setNotesOpen(true);
                }}
              >
                Normal exam
              </button>
            ) : null}
            <ExpandToggle open={notesOpen} onToggle={() => setNotesOpen((v) => !v)} iconOnly={cockpit} />
          </div>
        </div>
        {notesOpen ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 border-t border-border px-3 pb-3 pt-2">
            <label className="flex min-h-0 flex-1 flex-col text-xs font-medium text-text-secondary">
              Examination
              <textarea
                className={`${areaClass} flex-1 resize-none`}
                value={values.examination}
                onChange={(event) => setField("examination", event.target.value)}
                placeholder="Systemic findings (optional)…"
              />
            </label>
            <label className="flex min-h-0 flex-1 flex-col text-xs font-medium text-text-secondary">
              History of present illness
              <textarea
                className={`${areaClass} flex-1 resize-none`}
                value={values.summary}
                onChange={(event) => setField("summary", event.target.value)}
                placeholder="Onset, duration, associated symptoms (optional)…"
              />
            </label>
          </div>
        ) : values.examination.trim() || values.summary.trim() ? (
          <p className="border-t border-border px-3 py-2 text-xs text-text-secondary line-clamp-2">
            {[values.examination.trim(), values.summary.trim()].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className={`text-[13px] font-semibold 2xl:text-sm ${showDiagnosisError ? "text-critical" : "text-text-primary"}`}>
            Diagnosis <span className="font-normal text-critical">*</span>
          </p>
          {priorVisit?.diagnosis?.trim() && needsDiagnosis ? (
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline"
              onClick={() => {
                setField("diagnosis", priorVisit.diagnosis!.trim());
                offerTemplateFor(priorVisit.diagnosis!.trim());
              }}
            >
              Same as last visit
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {diagnosisChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => removeChip("diagnosis", chip, diagnosisChips)}
              className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-[13px] font-medium text-primary-dark"
              title="Remove"
            >
              {chip}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex min-w-0 gap-2">
          <input
            ref={diagnosisInputRef}
            className={`${inputClass} min-w-0 ${showDiagnosisError ? requiredFieldClass : ""}`}
            value={diagnosisDraft}
            placeholder="Add diagnosis and press Enter"
            aria-invalid={showDiagnosisError}
            onBlur={() => setDiagnosisTouched(true)}
            onChange={(event) => setDiagnosisDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const label = diagnosisDraft;
                addChip("diagnosis", label, diagnosisChips, setDiagnosisDraft);
                offerTemplateFor(label);
              }
            }}
          />
          <button
            type="button"
            className={`${
              cockpit
                ? "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-primary hover:bg-app-bg 2xl:h-10 2xl:rounded-lg 2xl:px-4 2xl:text-sm"
                : secondaryButtonClass
            } shrink-0`}
            onClick={() => {
              const label = diagnosisDraft;
              addChip("diagnosis", label, diagnosisChips, setDiagnosisDraft);
              offerTemplateFor(label);
            }}
          >
            Add
          </button>
        </div>
        {diagnosisSuggestions.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {diagnosisSuggestions
              .filter((item) => !diagnosisChips.some((chip) => chip.toLowerCase() === item.toLowerCase()))
              .map((item) => (
                <button
                  key={item}
                  type="button"
                  tabIndex={-1}
                  className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-app-bg"
                  onClick={() => {
                    addChip("diagnosis", item, diagnosisChips);
                    offerTemplateFor(item);
                  }}
                >
                  + {item}
                </button>
              ))}
          </div>
        ) : null}
        {showDiagnosisError ? <p className="mt-1 text-[11px] text-critical">Required</p> : null}
        {offeredTemplate ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary-light/50 px-2.5 py-2">
            <p className="min-w-0 flex-1 text-[13px] text-text-primary">
              Saved Rx <span className="font-medium">{offeredTemplate.name}</span> matches this diagnosis.
            </p>
            <button
              type="button"
              className="text-[13px] font-medium text-primary hover:underline"
              onClick={() => {
                setField("prescription", offeredTemplate.prescription);
                setOfferedTemplate(null);
              }}
            >
              Use it
            </button>
            <button
              type="button"
              className="text-[13px] font-medium text-text-secondary hover:underline"
              onClick={() => setOfferedTemplate(null)}
            >
              Not now
            </button>
            <button
              type="button"
              className="text-[13px] font-medium text-text-secondary hover:underline"
              onClick={() => {
                const id = offeredTemplate.id;
                setOfferedTemplate(null);
                setRxTemplates((current) => current.filter((row) => row.id !== id));
                void fetch(`/api/doctors/me/rx-templates/${id}`, { method: "DELETE" });
              }}
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>

      {!testsMountId ? (
        <div>
          <BloodTestPicker
            compact={cockpit}
            selectedInvestigations={investigations}
            onInvestigationsChange={(items) => {
              setInvestigations(items);
              if (items.length > 0 && !valuesRef.current.visitOutcome) {
                const next = { ...valuesRef.current, visitOutcome: "FOLLOW_UP" };
                valuesRef.current = next;
                setValues(next);
              }
            }}
            followUpAt={values.followUpAt}
            onFollowUpAtChange={(date) => {
              const next = { ...valuesRef.current, followUpAt: date, visitOutcome: "FOLLOW_UP" };
              valuesRef.current = next;
              setValues(next);
            }}
            locked={testsLocked}
            labEnabled={labEnabled}
            patientPhone={patientPhone}
            priorOrderCount={priorOrderCount}
            printHref={`/appointments/${appointmentId}/investigations`}
            ordersPanel={ordersPanel}
          />
          {investigations.length > 0 ? (
            <p className="mt-1.5 text-[11px] text-text-secondary">
              Schedule a follow-up to review results once reports are ready.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const plan = (
    <div className="space-y-2.5">
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-text-primary 2xl:text-sm">Prescription</p>
          {priorVisit?.prescription?.trim() && !values.prescription.trim() ? (
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline"
              onClick={() => setField("prescription", priorVisit.prescription!.trim())}
            >
              Repeat last Rx
            </button>
          ) : null}
        </div>
        <PrescriptionBuilder
          value={values.prescription}
          onChange={(v) => setField("prescription", v)}
          allergies={allergies}
          currentMedications={currentMedications}
        />
        {values.prescription.trim() && values.diagnosis.trim() ? (
          <div className="mt-1.5">
            {templateOpen ? (
              <div className="space-y-1.5 rounded-lg border border-border bg-app-bg p-2">
                <input
                  className={inputClass}
                  value={templateName}
                  placeholder="Template name, e.g. URTI adult"
                  onChange={(event) => setTemplateName(event.target.value)}
                />
                <input
                  className={inputClass}
                  value={templateDiagnosis}
                  placeholder="Diagnosis this Rx belongs to"
                  onChange={(event) => setTemplateDiagnosis(event.target.value)}
                />
                <div className="flex gap-2">
                  <button type="button" className={secondaryButtonClass} onClick={() => void saveRxTemplate()}>
                    Save
                  </button>
                  <button type="button" className="text-xs font-medium text-text-secondary" onClick={() => setTemplateOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-[11px] font-medium text-primary hover:underline"
                onClick={() => {
                  setTemplateDiagnosis(diagnosisChips[diagnosisChips.length - 1] ?? values.diagnosis.trim());
                  setTemplateName("");
                  setTemplateMessage("");
                  setTemplateOpen(true);
                }}
              >
                Save as Rx template
              </button>
            )}
            {templateMessage ? <p className="mt-1 text-[11px] text-text-secondary">{templateMessage}</p> : null}
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-[13px] font-semibold text-text-primary 2xl:text-sm">Advice</p>
        <textarea
          className={areaClass}
          rows={2}
          value={values.advice}
          onChange={(event) => setField("advice", event.target.value)}
          placeholder="Patient advice (optional)…"
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {adviceSuggestions
            .filter((item) => !values.advice.toLowerCase().includes(item.toLowerCase()))
            .map((item) => (
              <button
                key={item}
                type="button"
                tabIndex={-1}
                className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-app-bg"
                onClick={() => {
                  const current = values.advice.trim();
                  setField("advice", current ? `${current}; ${item}` : item);
                }}
              >
                + {item}
              </button>
            ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-text-primary 2xl:text-sm">Outcome</p>
          <button
            type="button"
            className="text-[11px] font-medium text-primary hover:underline"
            onClick={() => {
              approveAfterOutcomeRef.current = false;
              setApproveAfterOutcome(false);
              setFollowUpOpen(true);
            }}
          >
            Schedule
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            approveAfterOutcomeRef.current = false;
            setApproveAfterOutcome(false);
            setFollowUpOpen(true);
          }}
          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-app-bg px-2.5 py-2 text-left text-[12px] hover:bg-surface"
        >
          <span className="min-w-0 truncate text-text-primary">
            {values.visitOutcome === "DISCHARGE"
              ? "Discharged"
              : values.followUpAt
                ? `Follow-up · ${values.followUpAt}`
                : values.visitOutcome === "FOLLOW_UP"
                  ? "Follow-up · pick a date"
                  : "Not set — tap to schedule"}
          </span>
          <span className="shrink-0 text-text-secondary" aria-hidden>
            ›
          </span>
        </button>
      </div>
    </div>
  );

  const followUpDialog = followUpOpen ? (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-text-primary/40"
      onClick={() => closeOutcome()}
    >
      <div className="flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="follow-up-title"
          className="w-full max-w-sm rounded-xl border border-border bg-surface p-4 shadow-card"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <h3 id="follow-up-title" className="text-sm font-semibold text-text-primary">
              {approveAfterOutcome ? "Choose an outcome to approve" : "Visit outcome"}
            </h3>
            <button
              type="button"
              className="text-xs font-medium text-text-secondary hover:text-text-primary"
              onClick={() => closeOutcome()}
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                values.visitOutcome === "FOLLOW_UP"
                  ? "border-primary bg-primary-light text-primary-dark"
                  : "border-border text-text-secondary hover:bg-app-bg"
              }`}
              onClick={() => chooseFollowUp()}
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
              onClick={() => chooseDischarge()}
            >
              Discharge
            </button>
          </div>

          {values.visitOutcome !== "DISCHARGE" ? (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-text-secondary">
                Follow-up date
                <input
                  className={`${inputClass} mt-1`}
                  type="date"
                  value={values.followUpAt}
                  onChange={(event) => {
                    setField("followUpAt", event.target.value);
                    if (event.target.value) setField("visitOutcome", "FOLLOW_UP");
                  }}
                />
              </label>
              <div className="flex flex-wrap gap-1">
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
              <p className="rounded-lg border border-border bg-app-bg/70 px-2.5 py-2 text-[11px] text-text-secondary">
                On revisit, reception can add the patient to the queue as a follow-up and bring prior vitals plus the
                last assessment sheet so you can review them again.
              </p>
              {followUpReminderNote ? (
                <p className="text-[11px] text-text-secondary">{followUpReminderNote}</p>
              ) : null}
              <button
                type="button"
                className={`${primaryButtonClass} mt-1 w-full`}
                onClick={() => confirmOutcome()}
              >
                {approveAfterOutcome ? "Approve" : "Done"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  const actions = (
    <div
      className={
        cockpit
          ? "shrink-0 space-y-2 bg-surface"
          : "flex flex-wrap items-center gap-3"
      }
    >
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      {approveAttempted && missingForApprove.length > 0 ? (
        <p className="w-full text-xs text-text-secondary">Needs: {missingForApprove.join("; ")}</p>
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
          className={`${primaryButtonClass} shrink-0 ${cockpit ? "w-full sm:w-auto sm:min-w-[8.5rem]" : ""}`}
          type="button"
          disabled={Boolean(pending)}
          onClick={() => requestApprove(false)}
        >
          {pending === "approve"
            ? alreadyApproved
              ? "Publishing…"
              : "Approving…"
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
    <>
    <div
      className={
        cockpit
          ? "grid w-full min-w-0 grid-cols-1 items-stretch gap-2.5 overflow-x-hidden lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] 2xl:gap-3"
          : "grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      }
    >
      {!cockpit ? (
        <div>
          <h3 className="font-semibold">Doctor assessment</h3>
          <p className="mt-1 text-sm text-slate-500">
            Diagnosis is required to approve. Prescription and other fields are optional. Notes save automatically.
          </p>
        </div>
      ) : null}

      <section
        className={
          cockpit
            ? "flex min-w-0 flex-col rounded-xl border border-border bg-surface shadow-card lg:min-h-0 lg:overflow-hidden"
            : "space-y-3"
        }
      >
        {cockpit ? (
          <h3 className="shrink-0 px-2.5 pt-2.5 text-[13px] font-semibold text-text-primary 2xl:px-3 2xl:pt-3 2xl:text-sm">
            Findings
          </h3>
        ) : null}
        <div className={cockpit ? "px-2.5 pt-2 pb-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:[scrollbar-gutter:stable] 2xl:px-3 2xl:pb-3" : undefined}>
          {findings}
          {children ? <div className="mt-3 shrink-0 space-y-3">{children}</div> : null}
        </div>
      </section>

      <section
        className={
          cockpit
            ? "flex min-w-0 flex-col rounded-xl border border-border bg-surface shadow-card lg:min-h-0 lg:overflow-hidden"
            : "space-y-3"
        }
      >
        {cockpit ? (
          <h3 className="shrink-0 px-2.5 pt-2.5 text-[13px] font-semibold text-text-primary 2xl:px-3 2xl:pt-3 2xl:text-sm">
            Plan
          </h3>
        ) : null}
        <div className={cockpit ? "px-2.5 pt-2 pb-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:[scrollbar-gutter:stable] 2xl:px-3" : undefined}>
          {plan}
        </div>
        {cockpit ? (
          <div className="shrink-0 border-t border-border bg-surface px-2.5 py-2.5 2xl:px-3">{actions}</div>
        ) : (
          actions
        )}
      </section>
    </div>
    {followUpDialog}
    {testsMountEl
      ? createPortal(
          <BloodTestPicker
            compact={cockpit}
            variant="toolbar"
            selectedInvestigations={investigations}
            onInvestigationsChange={(items) => {
              setInvestigations(items);
              if (items.length > 0 && !valuesRef.current.visitOutcome) {
                const next = { ...valuesRef.current, visitOutcome: "FOLLOW_UP" };
                valuesRef.current = next;
                setValues(next);
              }
            }}
            followUpAt={values.followUpAt}
            onFollowUpAtChange={(date) => {
              const next = { ...valuesRef.current, followUpAt: date, visitOutcome: "FOLLOW_UP" };
              valuesRef.current = next;
              setValues(next);
            }}
            locked={testsLocked}
            labEnabled={labEnabled}
            patientPhone={patientPhone}
            priorOrderCount={priorOrderCount}
            printHref={`/appointments/${appointmentId}/investigations`}
            ordersPanel={ordersPanel}
          />,
          testsMountEl,
        )
      : null}
    </>
  );
}
