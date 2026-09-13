import PDFDocument from "pdfkit";
import { physicianLine, prettyEnum } from "@/lib/front-desk";
import {
  drawClinicalRow,
  drawIdentity,
  drawLetterhead,
  drawPrintFooter,
  drawSignoff,
  drawTitle,
  drawTwoColTable,
  drawVitalsList,
  printClock,
} from "@/lib/print-document-pdf";
import {
  ageGenderLine,
  encounterNumber,
  parseMedications,
  readableClinicalText,
  visitDateLabel,
} from "@/lib/visit-summary";

export type VisitSummaryPdfInput = {
  hospital: {
    name: string;
    address?: string | null;
    phone?: string | null;
    code: string;
    logoData?: string | null;
    sealData?: string | null;
  };
  patient: {
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth: Date;
    gender: string;
  };
  doctor: {
    firstName: string;
    lastName: string;
    appUser?: { username: string } | null;
  };
  departmentName: string;
  visitType: string;
  scheduledAt: Date;
  tokenNumber?: number | null;
  vitalsRows?: { label: string; value: string }[];
  printedAt?: string;
  assessment: {
    diagnosis?: string | null;
    chiefComplaint?: string | null;
    summary?: string | null;
    examination?: string | null;
    advice?: string | null;
    prescription?: string | null;
    visitOutcome?: string | null;
    followUpAt?: Date | null;
    approvedByDisplayName?: string | null;
    approvedByCredentials?: string | null;
    approvedBySignature?: { imageData?: string | null } | null;
  };
};

export async function buildVisitSummaryPdf(input: VisitSummaryPdfInput): Promise<Buffer> {
  const patientName = `${input.patient.firstName} ${input.patient.lastName}`.trim();
  const medicines = parseMedications(readableClinicalText(input.assessment.prescription));
  const followUp = input.assessment.followUpAt
    ? input.assessment.followUpAt.toLocaleDateString("en-IN", { dateStyle: "medium" })
    : null;
  const outcome =
    input.assessment.visitOutcome === "DISCHARGE"
      ? "Discharged"
      : followUp
        ? `Follow-up on ${followUp}`
        : input.assessment.visitOutcome === "FOLLOW_UP"
          ? "Follow up"
          : "—";
  const physician = physicianLine(input.doctor);
  const printedAt = input.printedAt ?? printClock();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawLetterhead(doc, input.hospital);
    drawTitle(doc, "Visit summary");
    drawIdentity(doc, {
      patientName,
      ageGender: ageGenderLine(input.patient.dateOfBirth, input.patient.gender),
      ids: [
        { label: "Encounter no.", value: encounterNumber(input.hospital.code, input.scheduledAt, input.tokenNumber) },
        { label: "UHID", value: input.patient.mrn },
      ],
      meta: [
        { label: "Appointment type", value: prettyEnum(input.visitType) },
        { label: "Date", value: visitDateLabel(input.scheduledAt) },
        { label: "Consulting physician", value: physician },
        { label: "Department", value: input.departmentName },
      ],
    });

    drawClinicalRow(doc, "Diagnosis", `Final Diagnosis: ${readableClinicalText(input.assessment.diagnosis) || "—"}`);
    drawClinicalRow(doc, "Presenting complaints", readableClinicalText(input.assessment.chiefComplaint) || "—");
    drawClinicalRow(doc, "History of present illness", readableClinicalText(input.assessment.summary) || "—");
    drawVitalsList(
      doc,
      input.vitalsRows && input.vitalsRows.length > 0
        ? input.vitalsRows
        : [
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
          ].map((label) => ({ label, value: "—" })),
    );
    drawClinicalRow(doc, "Systemic examination", readableClinicalText(input.assessment.examination) || "—");
    drawClinicalRow(doc, "Advice", readableClinicalText(input.assessment.advice) || "—");
    drawClinicalRow(doc, followUp ? "Follow-up" : "Outcome", outcome);

    drawTwoColTable(
      doc,
      ["Drug name", "Notes"],
      medicines.map((med) => ({ left: med.name, right: med.notes || "—" })),
    );

    drawSignoff(doc, {
      name: input.assessment.approvedByDisplayName || physician,
      credentials:
        [input.assessment.approvedByCredentials, input.departmentName].filter(Boolean).join("\n") ||
        input.departmentName,
      imageData: input.assessment.approvedBySignature?.imageData,
    });

    drawPrintFooter(doc, { printedAt, confidential: true });
    doc.end();
  });
}
