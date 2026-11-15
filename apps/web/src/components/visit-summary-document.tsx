import type { ReactNode } from "react";
import { SignatureBlock } from "@/components/signature-block";
import { VisitSheetHeader } from "@/components/visit-sheet-header";
import { visitSignoffLine } from "@/lib/doctor-specialties";
import { readHandwritingPages } from "@/lib/handwriting";
import { trimInkDataUrl } from "@/lib/trim-ink";
import { parseMedications, readableClinicalText } from "@/lib/visit-summary";

export function VisitSummaryDocument({
  hospitalName,
  hospitalAddress,
  hospitalPhone,
  logoData,
  sealData,
  patientName,
  mrn,
  ageGender,
  encounterNo,
  appointmentType,
  visitDate,
  physician,
  departmentName,
  diagnosis,
  chiefComplaint,
  history,
  generalExamination,
  vitalsRows,
  systemicExamination,
  advice,
  followUpAt,
  visitOutcome,
  prescription,
  printedAt,
  draft,
  signatureImage,
  signatureName,
  signatureCredentials,
  entryMode,
  handwritingPages,
}: {
  hospitalName: string;
  hospitalAddress?: string | null;
  hospitalPhone?: string | null;
  logoData?: string | null;
  sealData?: string | null;
  patientName: string;
  mrn: string;
  ageGender: string;
  encounterNo: string;
  appointmentType: string;
  visitDate: string;
  physician: string;
  departmentName: string;
  diagnosis?: string | null;
  chiefComplaint?: string | null;
  history?: string | null;
  generalExamination?: string | null;
  vitalsRows?: { label: string; value: string }[];
  systemicExamination?: string | null;
  advice?: string | null;
  followUpAt?: string | null;
  visitOutcome?: string | null;
  prescription?: string | null;
  printedAt: string;
  draft?: boolean;
  signatureImage?: string | null;
  signatureName?: string | null;
  signatureCredentials?: string | null;
  entryMode?: string | null;
  handwritingPages?: string[] | string | null;
}) {
  const medicines = parseMedications(readableClinicalText(prescription));
  const vitals = examinationVitals(vitalsRows, generalExamination);
  const diagnosisText = readableClinicalText(diagnosis);
  const complaintText = readableClinicalText(chiefComplaint);
  const historyText = readableClinicalText(history);
  const systemicText = readableClinicalText(systemicExamination);
  const adviceText = readableClinicalText(advice);
  const outcomeText =
    visitOutcome === "DISCHARGE"
      ? "Discharged"
      : followUpAt
        ? `Follow-up on ${followUpAt}`
        : visitOutcome === "FOLLOW_UP"
          ? "Follow up"
          : "";
  const handwritten = entryMode === "HANDWRITTEN";
  const inkPages = handwritten ? readHandwritingPages(handwritingPages) : [];

  return (
    <article className="visit-summary-print">
      <div className="vs-sheet">
        {draft ? (
          <p className="vs-draft">Draft preview — approve to release for reception print</p>
        ) : null}

        <VisitSheetHeader
          hospitalName={hospitalName}
          hospitalAddress={hospitalAddress}
          hospitalPhone={hospitalPhone}
          logoData={logoData}
          sealData={sealData}
          patientName={patientName}
          mrn={mrn}
          ageGender={ageGender}
          encounterNo={encounterNo}
          appointmentType={appointmentType}
          visitDate={visitDate}
          physician={physician}
          departmentName={departmentName}
          vitalsRows={vitals}
        />

        <div className="vs-clinical">
          {handwritten ? (
            <div className="vs-ink">
              {inkPages.length > 0 ? (
                inkPages.map((page, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${index}-${page.length}`}
                    src={trimInkDataUrl(page)}
                    alt={`Handwritten note page ${index + 1}`}
                    className="vs-ink-page"
                  />
                ))
              ) : (
                <p className="vs-body">—</p>
              )}
            </div>
          ) : (
            <>
              <ClinicalRow label="Diagnosis">
                <p className="vs-diagnosis-value">Final Diagnosis: {diagnosisText || "—"}</p>
              </ClinicalRow>

              <ClinicalRow label="Presenting complaints">
                <p className="vs-body">{complaintText || "—"}</p>
              </ClinicalRow>

              <ClinicalRow label="History of present illness">
                <p className="vs-body">{historyText || "—"}</p>
              </ClinicalRow>

              <ClinicalRow label="Systemic examination">
                <p className="vs-body">{systemicText || "—"}</p>
              </ClinicalRow>

              <ClinicalRow label="Advice">
                <p className="vs-body">{adviceText || "—"}</p>
              </ClinicalRow>
            </>
          )}

          <ClinicalRow label={followUpAt ? "Follow-up" : "Outcome"}>
            <p className="vs-body vs-followup">{outcomeText || "—"}</p>
          </ClinicalRow>
        </div>

        {handwritten ? null : (
        <section className="vs-meds">
          <table className="vs-table">
            <thead>
              <tr>
                <th>Drug name</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {medicines.length > 0 ? (
                medicines.map((row, index) => (
                  <tr key={`${row.name}-${row.notes}-${index}`}>
                    <td className="vs-drug">{row.name}</td>
                    <td>{row.notes || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="vs-drug">—</td>
                  <td>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        )}

        <section className="vs-signoff">
          <div className="vs-signoff-spacer" />
          <SignatureBlock
            role=""
            name={signatureName || physician}
            credentials={visitSignoffLine(signatureCredentials, departmentName)}
            imageData={draft ? null : signatureImage}
          />
        </section>
      </div>

      <footer className="vs-footer">
        <p className="vs-confidential">
          This document contains confidential information about your health. It is provided directly
          to you for your personal use only.
        </p>
        <p className="vs-eoe">E &amp; OE</p>
        <div className="vs-footer-meta">
          <span>Page 1/1</span>
          <span>Printed on: {printedAt}</span>
        </div>
      </footer>
    </article>
  );
}

function ClinicalRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="vs-row">
      <p className="vs-row-label">{label}</p>
      <div className="vs-row-body">{children}</div>
    </div>
  );
}

function examinationVitals(
  vitalsRows?: { label: string; value: string }[],
  generalExamination?: string | null,
) {
  if (vitalsRows && vitalsRows.length > 0) return vitalsRows;
  const fromText = labeledLines(generalExamination);
  if (fromText.length > 0) return fromText;
  return [
    "Temperature",
    "Height",
    "Weight",
    "BMI",
    "BSA",
    "SpO2",
    "Pulse",
    "Respiratory rate",
    "BP",
    "Blood sugar",
    "Fever",
    "Vital remarks",
  ].map((label) => ({ label, value: "—" }));
}

function labeledLines(text?: string | null) {
  if (!text?.trim()) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(":");
      if (index === -1) return { label: "", value: line };
      return { label: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
    });
}
