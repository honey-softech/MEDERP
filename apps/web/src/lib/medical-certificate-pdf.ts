import PDFDocument from "pdfkit";
import { ageGenderLine } from "@/lib/visit-summary";
import { certificateLetter, certificateTitle, formatCertDate } from "@/lib/medical-certificates";
import {
  drawClinicalRow,
  drawIdentity,
  drawLetterhead,
  drawPrintFooter,
  drawSignoff,
  drawTitle,
  printClock,
} from "@/lib/print-document-pdf";
import type { MedicalCertificateType } from "@prisma/client";

export type MedicalCertificatePdfInput = {
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
    issuedBySignature?: { imageData?: string | null } | null;
    status: string;
  };
  printedAt?: string;
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
  const printedAt = input.printedAt ?? printClock();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (input.certificate.status === "VOIDED") {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#b91c1c").text("Voided — this certificate is no longer valid", {
        align: "center",
      });
      doc.fillColor("#1a1a1a");
      doc.moveDown(0.3);
    }

    drawLetterhead(doc, input.hospital);
    drawTitle(doc, certificateTitle(input.certificate.type));
    drawIdentity(doc, {
      patientName,
      ageGender: ageGenderLine(input.patient.dateOfBirth, input.patient.gender),
      ids: [
        { label: "Certificate no.", value: input.certificate.certificateNo },
        { label: "UHID", value: input.patient.mrn },
      ],
      meta: [{ label: "Issued", value: formatCertDate(input.certificate.issuedAt) }],
    });
    drawClinicalRow(doc, "Certificate", letter);
    drawSignoff(doc, {
      name: issuer,
      credentials: input.certificate.issuedByCredentials,
      imageData: input.certificate.status === "VOIDED" ? null : input.certificate.issuedBySignature?.imageData,
    });
    drawPrintFooter(doc, { printedAt, confidential: true });
    doc.end();
  });
}
