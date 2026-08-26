"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { ExpandToggle } from "@/components/expand-toggle";
import type { VitalsValues } from "@/lib/vitals";
import { VitalsPanel } from "@/components/vitals-panel";
import { VisitHistorySheet, type PastVisitItem } from "@/components/visit-history-sheet";

export type PatientContextData = {
  id: string;
  name: string;
  mrn: string;
  ageGender: string;
  phone: string;
  address: string;
  bloodGroup: string;
  photo: string;
  allergies: string;
  medicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  currentMedications: string;
};

export type PriorVisitSummary = {
  scheduledAtLabel: string;
  diagnosis: string;
  prescription: string;
  chiefComplaint: string;
} | null;

export function PatientContextPanel({
  patient,
  vitals,
  priorVisit,
  pastVisits = [],
  canEditHistory,
  canPrintSummary = false,
  canViewLabReports = false,
}: {
  patient: PatientContextData;
  vitals: VitalsValues | null;
  priorVisit: PriorVisitSummary;
  pastVisits?: PastVisitItem[];
  canEditHistory: boolean;
  canPrintSummary?: boolean;
  canViewLabReports?: boolean;
}) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [allergies, setAllergies] = useState(patient.allergies);
  const [medicalHistory, setMedicalHistory] = useState(patient.medicalHistory);
  const [familyHistory, setFamilyHistory] = useState(patient.familyHistory);
  const [socialHistory, setSocialHistory] = useState(patient.socialHistory);
  const [currentMedications, setCurrentMedications] = useState(patient.currentMedications);

  async function saveHistory() {
    setError("");
    setMessage("");
    setPending(true);
    const response = await fetch(`/api/patients/${patient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allergies,
        medicalHistory,
        familyHistory,
        socialHistory,
        currentMedications,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save history.");
      return;
    }
    setMessage("History saved.");
    setEditing(false);
    router.refresh();
  }

  return (
    <aside className="space-y-2">
      <section className="rounded-xl border border-border bg-surface p-2.5 shadow-card">
        <div className="flex gap-2.5">
          <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-app-bg">
            {patient.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={patient.photo} alt={patient.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-text-disabled">
                No photo
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-text-primary">{patient.name}</h2>
            <p className="font-mono text-[11px] text-text-secondary">{patient.mrn}</p>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              {patient.ageGender}
              {patient.phone ? ` · ${patient.phone}` : ""}
            </p>
            {patient.bloodGroup ? (
              <p className="mt-1 inline-flex rounded bg-primary-light px-1.5 py-0.5 text-[11px] font-medium text-primary-dark">
                Blood {patient.bloodGroup}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {vitals ? (
        <VitalsPanel vitals={vitals} compact />
      ) : (
        <p className="rounded-xl border border-warning-bg bg-warning-bg px-3 py-2 text-xs text-text-secondary">
          Nurse vitals not recorded yet.
        </p>
      )}

      <section className="rounded-xl border border-border bg-surface px-2.5 py-2 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">History</h3>
          <div className="flex items-center gap-1">
            {canEditHistory ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  setEditing((v) => !v);
                  setHistoryOpen(true);
                  setError("");
                  setMessage("");
                }}
              >
                {editing ? "Cancel" : "Edit"}
              </button>
            ) : null}
            <ExpandToggle open={historyOpen} onToggle={() => setHistoryOpen((v) => !v)} />
          </div>
        </div>

        {historyOpen ? (
          editing ? (
            <div className="mt-2 space-y-2">
              <HistoryField label="Allergies" value={allergies} onChange={setAllergies} />
              <HistoryField label="Medical history" value={medicalHistory} onChange={setMedicalHistory} />
              <HistoryField label="Family history" value={familyHistory} onChange={setFamilyHistory} />
              <HistoryField label="Social history" value={socialHistory} onChange={setSocialHistory} />
              <HistoryField label="Current medications" value={currentMedications} onChange={setCurrentMedications} />
              {error ? <p className="text-xs text-critical">{error}</p> : null}
              {message ? <p className="text-xs text-success">{message}</p> : null}
              <button type="button" className={secondaryButtonClass} disabled={pending} onClick={() => void saveHistory()}>
                {pending ? "Saving…" : "Save history"}
              </button>
            </div>
          ) : (
            <dl className="mt-2 space-y-2 text-xs">
              <HistoryRow label="Allergies" value={allergies} alert={Boolean(allergies.trim())} />
              <HistoryRow label="Medical history" value={medicalHistory} />
              <HistoryRow label="Family history" value={familyHistory} />
              <HistoryRow label="Social history" value={socialHistory} />
              <HistoryRow label="Current medications" value={currentMedications} />
            </dl>
          )
        ) : allergies.trim() ? (
          <p className="mt-1 text-[11px] font-medium text-critical">Allergy · {allergies}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface px-2.5 py-2 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">Last visit</h3>
            <p className="mt-0.5 truncate text-[11px] text-text-secondary">
              {priorVisit ? priorVisit.scheduledAtLabel : "No earlier visit"}
            </p>
          </div>
          <VisitHistorySheet
            visits={pastVisits}
            patientHref={`/patients/${patient.id}`}
            canPrintSummary={canPrintSummary}
            canViewLabReports={canViewLabReports}
            label="All visits"
            variant="link"
          />
        </div>
        {priorVisit?.chiefComplaint ? (
          <p className="mt-1 truncate text-xs">
            <span className="text-text-secondary">Complaint · </span>
            {priorVisit.chiefComplaint}
          </p>
        ) : null}
        {priorVisit?.diagnosis ? (
          <p className="mt-0.5 truncate text-xs">
            <span className="text-text-secondary">Dx · </span>
            {priorVisit.diagnosis}
          </p>
        ) : null}
      </section>
    </aside>
  );
}

function HistoryField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-medium text-text-secondary">
      {label}
      <textarea className={`${fieldClass} mt-1 text-sm`} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function HistoryRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <dt className="font-medium uppercase tracking-wide text-text-disabled">{label}</dt>
      <dd className={`mt-0.5 whitespace-pre-wrap ${alert ? "font-medium text-critical" : "text-text-primary"}`}>
        {value.trim() || "—"}
      </dd>
    </div>
  );
}
