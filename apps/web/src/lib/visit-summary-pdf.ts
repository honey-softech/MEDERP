import PDFDocument from "pdfkit";
import { physicianLine, prettyEnum } from "@/lib/front-desk";
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
  };
};

function section(doc: PDFKit.PDFDocument, title: string, body?: string | null) {
  const text = readableClinicalText(body);
  if (!text) return;
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(11).text(title);
  doc.font("Helvetica").fontSize(10).text(text, { lineGap: 2 });
}

export async function buildVisitSummaryPdf(input: VisitSummaryPdfInput): Promise<Buffer> {
  const patientName = `${input.patient.firstName} ${input.patient.lastName}`.trim().toUpperCase();
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
          : "";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(16).text(input.hospital.name, { align: "center" });
    doc.font("Helvetica").fontSize(9);
    if (input.hospital.address) doc.text(input.hospital.address, { align: "center" });
    if (input.hospital.phone) doc.text(`Phone: ${input.hospital.phone}`, { align: "center" });
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).text("Visit summary", { align: "center" });
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(10);
    const meta = [
      `Patient: ${patientName}`,
      `MRN: ${input.patient.mrn}`,
      `Age / Gender: ${ageGenderLine(input.patient.dateOfBirth, input.patient.gender)}`,
      `Encounter: ${encounterNumber(input.hospital.code, input.scheduledAt, input.tokenNumber)}`,
      `Visit type: ${prettyEnum(input.visitType)}`,
      `Date: ${visitDateLabel(input.scheduledAt)}`,
      `Physician: ${physicianLine(input.doctor)}`,
      `Department: ${input.departmentName}`,
    ];
    for (const line of meta) doc.text(line);

    section(doc, "Chief complaint", input.assessment.chiefComplaint);
    section(doc, "History / summary", input.assessment.summary);
    section(doc, "Examination", input.assessment.examination);
    section(doc, "Diagnosis", input.assessment.diagnosis);
    section(doc, "Advice", input.assessment.advice);

    if (medicines.length > 0) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(11).text("Prescription");
      doc.font("Helvetica").fontSize(10);
      for (const med of medicines) {
        doc.text(med.notes ? `• ${med.name} — ${med.notes}` : `• ${med.name}`);
      }
    }

    if (outcome) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(11).text("Outcome");
      doc.font("Helvetica").fontSize(10).text(outcome);
    }

    if (input.assessment.approvedByDisplayName) {
      doc.moveDown(1);
      doc.font("Helvetica").fontSize(10).text(`Approved by: ${input.assessment.approvedByDisplayName}`);
      if (input.assessment.approvedByCredentials) {
        doc.text(input.assessment.approvedByCredentials);
      }
    }

    doc.moveDown(1.2);
    doc.fontSize(8).fillColor("#666666").text(
      `Generated ${new Date().toLocaleString("en-IN")} · MedERP`,
      { align: "center" },
    );

    doc.end();
  });
}
