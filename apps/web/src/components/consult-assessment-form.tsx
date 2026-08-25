"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BloodTestPicker } from "@/components/blood-test-picker";
import { PrescriptionBuilder } from "@/components/prescription-builder";
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
};

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
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
  });
  const [investigations, setInvestigations] = useState<InvestigationPick[]>(
    initialInvestigations ?? initialTestIds.map((testId) => ({ testId })),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [saved, setSaved] = useState(canPreview);

  function setField<K extends keyof AssessmentValues>(key: K, value: AssessmentValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(action: "save" | "approve") {
    setError("");
    setPending(action);
    const response = await fetch(`/api/appointments/${appointmentId}/assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...values, investigations }),
    });
    const raw = await response.text();
    let data: { error?: string } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: "Could not save the visit summary." };
    }
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not save the visit summary.");
      return;
    }
    setSaved(true);
    if (action === "approve") {
      router.push(`/appointments/${appointmentId}/summary`);
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save("save");
      }}
      className="grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <h3 className="font-semibold">Doctor assessment</h3>
        <p className="mt-1 text-sm text-slate-500">
          {alreadyApproved
            ? "This visit summary is approved. Edit below and publish a new version when ready. Reception can still print the last approved record until you publish."
            : "Record the consult, save a draft to preview the printed page, then approve. After approval, reception and doctors can print the record."}
          {awaitingOutsideReport
            ? " Recommended tests/scans are outside this hospital. Save a draft now if needed; after the report is attached, update the assessment and approve the visit summary."
            : null}
          {outsideReportReady
            ? " The outside report is on this visit. Review it, update the assessment if needed, then approve the visit summary."
            : null}
        </p>
        {alreadyApproved ? (
          <p className="mt-2 rounded-lg border border-primary-light bg-primary-light/50 px-3 py-2 text-sm text-primary-dark">
            Approved summary — changes are saved as a draft until you publish a new version.
          </p>
        ) : null}
      </div>

      <h4 className="md:col-span-2 mt-2 border-t border-slate-100 pt-4 font-semibold">Clinical assessment</h4>
      <Area label="Chief complaint" value={values.chiefComplaint} onChange={(v) => setField("chiefComplaint", v)} />
      <Area label="Examination" value={values.examination} onChange={(v) => setField("examination", v)} />
      <Field label="Diagnosis" value={values.diagnosis} onChange={(v) => setField("diagnosis", v)} />
      <Field label="Follow-up date" type="date" value={values.followUpAt} onChange={(v) => setField("followUpAt", v)} />

      <h4 className="md:col-span-2 mt-2 border-t border-slate-100 pt-4 font-semibold">Visit summary</h4>
      <Area
        label="Clinical summary"
        value={values.summary}
        onChange={(v) => setField("summary", v)}
        className="md:col-span-2"
        rows={5}
      />

      <PrescriptionBuilder value={values.prescription} onChange={(v) => setField("prescription", v)} />
      <Area label="Advice / instructions" value={values.advice} onChange={(v) => setField("advice", v)} className="md:col-span-2" />
      <BloodTestPicker
        selectedInvestigations={investigations}
        onInvestigationsChange={setInvestigations}
        locked={testsLocked}
        labEnabled={labEnabled}
        patientPhone={patientPhone}
        priorOrderCount={priorOrderCount}
      />

      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      <div className="md:col-span-2 flex flex-wrap gap-2">
        <button className={secondaryButtonClass} type="submit" disabled={Boolean(pending)}>
          {pending === "save" ? "Saving…" : alreadyApproved ? "Save as draft" : "Save draft"}
        </button>
        <button className={primaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void save("approve")}>
          {pending === "approve"
            ? alreadyApproved
              ? "Publishing…"
              : "Approving…"
            : alreadyApproved
              ? "Publish new version"
              : "Approve summary"}
        </button>
        {saved ? (
          <Link href={`/appointments/${appointmentId}/summary`} className={secondaryButtonClass}>
            Preview
          </Link>
        ) : null}
      </div>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  rows?: number;
}) {
  return (
    <label className={`text-sm font-medium text-slate-700 ${className ?? ""}`}>
      {label}
      <textarea className={fieldClass} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
