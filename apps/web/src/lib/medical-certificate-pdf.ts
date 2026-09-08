import PDFDocument from "pdfkit";
import { ageGenderLine } from "@/lib/visit-summary";
import { certificateLetter, certificateTitle, formatCertDate } from "@/lib/medical-certificates";
import type { MedicalCertificateType } from "@prisma/client";

export type MedicalCertificatePdfInput = {
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
  certificate: {
    certificateNo: string;
    type: MedicalCertificateType;
    diagnosis: string;
    remarks?: string | null;
    restFrom?: Date | null;
    restTo?: Date | null;
    fitFor?: string | null;
    purpose?: string | null;
    issuedAt: Date;
    issuedByDisplayName?: string | null;
    issuedByCredentials?: string | null;
    issuedByUsername: string;
    status: string;
  };
};

export async function buildMedicalCertificatePdf(input: MedicalCertificatePdfInput): Promise<Buffer> {
  const patientName = `${input.patient.firstName} ${input.patient.lastName}`.trim();
  const letter = certificateLetter({
    type: input.certificate.type,
    patientName,
    mrn: input.patient.mrn,
    dateOfBirth: input.patient.dateOfBirth,
    gender: input.patient.gender,
    diagnosis: input.certificate.diagnosis,
    remarks: input.certificate.remarks,
    restFrom: input.certificate.restFrom,
    restTo: input.certificate.restTo,
    fitFor: input.certificate.fitFor,
    purpose: input.certificate.purpose,
    issuedAt: input.certificate.issuedAt,
  });
  const issuer = input.certificate.issuedByDisplayName || input.certificate.issuedByUsername;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (input.certificate.status === "VOIDED") {
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#b91c1c").text("VOIDED", { align: "center" });
      doc.fillColor("#000000");
      doc.moveDown(0.4);
    }

    doc.font("Helvetica-Bold").fontSize(16).text(input.hospital.name, { align: "center" });
    doc.font("Helvetica").fontSize(9);
    if (input.hospital.address) doc.text(input.hospital.address, { align: "center" });
    if (input.hospital.phone) doc.text(`Phone: ${input.hospital.phone}`, { align: "center" });
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).text(certificateTitle(input.certificate.type), { align: "center" });
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(10);
    doc.text(`Certificate no.: ${input.certificate.certificateNo}`);
    doc.text(`Patient: ${patientName.toUpperCase()}`);
    doc.text(`UHID: ${input.patient.mrn}`);
    doc.text(`Age / Gender: ${ageGenderLine(input.patient.dateOfBirth, input.patient.gender)}`);
    doc.text(`Issued: ${formatCertDate(input.certificate.issuedAt)}`);
    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(11).text(letter, { lineGap: 4, align: "justify" });

    doc.moveDown(1.4);
    doc.font("Helvetica").fontSize(10).text(issuer);
    if (input.certificate.issuedByCredentials) {
      doc.fontSize(9).text(input.certificate.issuedByCredentials);
    }
    doc.fontSize(9).text("Registered medical practitioner");

    doc.moveDown(1.2);
    doc.fontSize(8).fillColor("#666666").text(
      `Generated ${new Date().toLocaleString("en-IN")} · MedERP`,
      { align: "center" },
    );

    doc.end();
  });
}
