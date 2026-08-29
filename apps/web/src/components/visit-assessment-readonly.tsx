import Link from "next/link";
import { compactButtonClass, primaryButtonClass } from "@/components/auth-shell";
import { parseMedications } from "@/lib/prescription-text";
import { readableClinicalText } from "@/lib/visit-summary";

export function VisitAssessmentReadonly({
  appointmentId,
  statusLabel,
  summaryApproved,
  canEdit,
  canPrint,
  chiefComplaint,
  examination,
  diagnosis,
  summary,
  prescription,
  advice,
  visitOutcome,
  followUpAt,
}: {
  appointmentId: string;
  statusLabel: string;
  summaryApproved: boolean;
  canEdit: boolean;
  canPrint: boolean;
  chiefComplaint?: string | null;
  examination?: string | null;
  diagnosis?: string | null;
  summary?: string | null;
  prescription?: string | null;
  advice?: string | null;
  visitOutcome?: string | null;
  followUpAt?: Date | string | null;
}) {
  const medicines = parseMedications(readableClinicalText(prescription));
  const diagnosisText = readableClinicalText(diagnosis);
  const complaintText = readableClinicalText(chiefComplaint);
  const historyText = readableClinicalText(summary);
  const examText = readableClinicalText(examination);
  const adviceText = readableClinicalText(advice);
  const followUpLabel = followUpAt
    ? new Date(followUpAt).toLocaleDateString("en-IN", { dateStyle: "medium" })
    : null;
  const outcomeLabel =
    visitOutcome === "DISCHARGE"
      ? "Discharged"
      : followUpLabel
        ? `Follow-up on ${followUpLabel}`
        : visitOutcome === "FOLLOW_UP"
          ? "Follow up"
          : "";

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-teal-900">
            {summaryApproved ? "Visit summary approved" : "Visit closed"}
          </p>
          <p className="mt-0.5 text-xs text-teal-800">
            {statusLabel}. Open print view for the patient record
            {canEdit ? ", or edit to change the assessment" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {canPrint && summaryApproved ? (
            <Link href={`/appointments/${appointmentId}/summary`} className={primaryButtonClass}>
              Print record
            </Link>
          ) : null}
          {canEdit ? (
            <Link href={`/appointments/${appointmentId}?edit=1`} className={compactButtonClass}>
              Edit assessment
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <section className="min-w-0 space-y-3 rounded-xl border border-border bg-surface p-3 shadow-card">
          <h3 className="text-sm font-semibold text-text-primary">Patient today</h3>
          <ReadonlyBlock label="Chief complaints" value={complaintText} />
          <ReadonlyBlock label="Examination" value={examText} />
          <ReadonlyBlock label="History of present illness" value={historyText} />
        </section>

        <section className="min-w-0 space-y-3 rounded-xl border border-border bg-surface p-3 shadow-card">
          <h3 className="text-sm font-semibold text-text-primary">Plan</h3>
          <ReadonlyBlock label="Diagnosis" value={diagnosisText} strong />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Prescription
            </p>
            {medicines.length === 0 ? (
              <p className="mt-1 text-sm text-text-secondary">No medicines recorded.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {medicines.map((row, index) => (
                  <li key={`${row.name}-${index}`} className="text-sm text-text-primary">
                    <span className="font-medium">{row.name}</span>
                    {row.notes ? (
                      <span className="text-text-secondary"> · {row.notes}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ReadonlyBlock label="Advice" value={adviceText} />
          {outcomeLabel ? <ReadonlyBlock label="Outcome" value={outcomeLabel} strong /> : null}
        </section>
      </div>
    </div>
  );
}

function ReadonlyBlock({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p
        className={`mt-1 whitespace-pre-wrap text-sm ${strong ? "font-semibold text-text-primary" : "text-text-primary"} ${value ? "" : "text-text-secondary"}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}
