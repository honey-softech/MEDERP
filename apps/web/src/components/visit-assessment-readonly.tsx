import { trimInkDataUrl } from "@/lib/trim-ink";
import { parseMedications } from "@/lib/prescription-text";
import { readableClinicalText } from "@/lib/visit-summary";

/** Status-only strip — actions live once in the page header. */
export function VisitSummaryBanner({
  statusLabel,
  summaryApproved,
}: {
  appointmentId?: string;
  statusLabel: string;
  summaryApproved: boolean;
  canEdit?: boolean;
  canPrint?: boolean;
  patientPhone?: string | null;
}) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
      <p className="text-sm font-semibold text-teal-900">
        {summaryApproved ? "Visit summary approved" : "Visit closed"}
        <span className="font-normal text-teal-800"> · {statusLabel}</span>
      </p>
    </div>
  );
}

export function VisitAssessmentReadonly({
  appointmentId,
  statusLabel,
  summaryApproved,
  canEdit,
  canPrint,
  patientPhone,
  chiefComplaint,
  examination,
  diagnosis,
  summary,
  prescription,
  advice,
  visitOutcome,
  followUpAt,
  entryMode,
  handwritingPages,
  aiAssisted = false,
  omitBanner = false,
}: {
  appointmentId: string;
  statusLabel: string;
  summaryApproved: boolean;
  canEdit: boolean;
  canPrint: boolean;
  patientPhone?: string | null;
  chiefComplaint?: string | null;
  examination?: string | null;
  diagnosis?: string | null;
  summary?: string | null;
  prescription?: string | null;
  advice?: string | null;
  visitOutcome?: string | null;
  followUpAt?: Date | string | null;
  entryMode?: string | null;
  handwritingPages?: string[] | null;
  aiAssisted?: boolean;
  omitBanner?: boolean;
}) {
  const medicines = parseMedications(readableClinicalText(prescription));
  const diagnosisText = readableClinicalText(diagnosis);
  const complaintText = readableClinicalText(chiefComplaint);
  const historyText = readableClinicalText(summary);
  const examText = readableClinicalText(examination);
  const adviceText = readableClinicalText(advice);
  const followUpLabel = followUpAt
    ? new Date(followUpAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })
    : null;
  const outcomeLabel =
    visitOutcome === "DISCHARGE"
      ? "Discharged"
      : followUpLabel
        ? `Follow-up on ${followUpLabel}`
        : visitOutcome === "FOLLOW_UP"
          ? "Follow up"
          : "";
  const handwritten = entryMode === "HANDWRITTEN";
  const inkPages = handwritten ? (handwritingPages ?? []).filter((page) => page.startsWith("data:image/")) : [];
  const hasTyped = Boolean(complaintText || examText || diagnosisText || historyText || adviceText || medicines.length);

  return (
    <div className="min-w-0 space-y-3">
      {omitBanner ? null : (
        <VisitSummaryBanner statusLabel={statusLabel} summaryApproved={summaryApproved} />
      )}
      {aiAssisted ? (
        <p className="print:hidden text-xs text-text-secondary">
          Drafted with AI and approved by the doctor.
        </p>
      ) : null}

      <div className="grid min-w-0 gap-3 lg:grid-cols-2 lg:gap-4">
        {handwritten ? (
          <section className="min-w-0 space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5 lg:col-span-2">
            <h3 className="text-base font-semibold text-text-primary">Handwritten note</h3>
            {inkPages.length > 0 ? (
              <div className="space-y-3">
                {inkPages.map((page, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${index}-${page.length}`}
                    src={trimInkDataUrl(page)}
                    alt={`Handwritten note page ${index + 1}`}
                    className="w-full rounded-lg border border-border bg-white"
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No handwritten page was saved.</p>
            )}
            {outcomeLabel ? <ReadonlyBlock label="Outcome" value={outcomeLabel} strong /> : null}
          </section>
        ) : null}
        {hasTyped || !handwritten ? (
        <>
        <section className="min-w-0 space-y-4 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <h3 className="text-base font-semibold text-text-primary">Patient today</h3>
          <ReadonlyBlock label="Chief complaints" value={complaintText} />
          <ReadonlyBlock label="Examination" value={examText} />
          <ReadonlyBlock label="History of present illness" value={historyText} />
        </section>

        <section className="min-w-0 space-y-4 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <h3 className="text-base font-semibold text-text-primary">Plan</h3>
          <ReadonlyBlock label="Diagnosis" value={diagnosisText} strong />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Prescription
            </p>
            {medicines.length === 0 ? (
              <p className="mt-1.5 text-sm text-text-secondary">No medicines recorded.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {medicines.map((row, index) => (
                  <li key={`${row.name}-${index}`} className="text-sm leading-relaxed text-text-primary">
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
          {outcomeLabel && !handwritten ? <ReadonlyBlock label="Outcome" value={outcomeLabel} strong /> : null}
        </section>
        </>
        ) : null}
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
        className={`mt-1.5 whitespace-pre-wrap text-sm leading-relaxed ${strong ? "font-semibold text-text-primary" : "text-text-primary"} ${value ? "" : "text-text-secondary"}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}
