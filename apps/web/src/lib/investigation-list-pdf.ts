import PDFDocument from "pdfkit";
import { physicianLine, tokenLabel } from "@/lib/front-desk";
import {
  drawLetterhead,
  drawPrintFooter,
  drawSignoff,
  drawThreeColTable,
  pageWidth,
  printClock,
} from "@/lib/print-document-pdf";
import { ageGenderLine } from "@/lib/visit-summary";

export type InvestigationListPdfItem = {
  name: string;
  category: string;
  outside: boolean;
};

export type InvestigationListPdfInput = {
  hospital: {
    name: string;
    address?: string | null;
    phone?: string | null;
    logoData?: string | null;
    sealData?: string | null;
  };
  patient: {
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth: Date;
    gender: string;
    phone?: string | null;
  };
  doctor: {
    firstName: string;
    lastName: string;
    medicalDegree?: string | null;
    postgraduate?: string | null;
    specialization?: string | null;
    appUser?: { username: string } | null;
  };
  departmentName: string;
  scheduledAt: Date;
  tokenNumber?: number | null;
  items: InvestigationListPdfItem[];
  requestedBy?: string | null;
  requestedByCredentials?: string | null;
  requestedByImage?: string | null;
  printedBy?: string | null;
  printedAt?: string;
};

export async function buildInvestigationListPdf(input: InvestigationListPdfInput): Promise<Buffer> {
  const patientName = `${input.patient.firstName} ${input.patient.lastName}`.trim();
  const hasOutside = input.items.some((item) => item.outside);
  const doctor = physicianLine(input.doctor);
  const printedAt = input.printedAt ?? printClock();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = pageWidth(doc);

    drawLetterhead(doc, input.hospital, { kicker: "Investigation request" });

    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("Patient · ", left, doc.y, { continued: true });
    doc.font("Helvetica-Bold").fillColor("#0f172a").text(`${patientName.toUpperCase()}`, { continued: true });
    doc.font("Helvetica").text(` · ${input.patient.mrn} · ${ageGenderLine(input.patient.dateOfBirth, input.patient.gender)}`);
    if (input.patient.phone) {
      doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("Phone · ", { continued: true });
      doc.fillColor("#0f172a").text(input.patient.phone);
    }
    doc.fillColor("#64748b").text("Doctor · ", { continued: true });
    doc.fillColor("#0f172a").text(`${doctor} · ${input.departmentName}`);
    doc.fillColor("#64748b").text("Visit · ", { continued: true });
    const visitWhen = input.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    doc
      .fillColor("#0f172a")
      .text(`${visitWhen}${input.tokenNumber ? ` · Token ${tokenLabel(input.tokenNumber)}` : ""}`);

    doc.moveDown(0.7);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text("Tests / scans", left);
    doc.moveDown(0.25);
    if (input.items.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("No tests or scans on this visit yet.", left, doc.y, {
        width,
      });
    } else {
      drawThreeColTable(
        doc,
        ["Test / scan", "Category", "Where"],
        input.items.map((item) => [item.name, item.category, item.outside ? "Outside" : "Hospital lab"]),
      );
    }

    if (hasOutside) {
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(8).fillColor("#475569");
      doc.text("Complete outside tests and bring the reports to the hospital.", left, doc.y, { width });
    }

    if (input.requestedBy) {
      drawSignoff(doc, {
        role: "Ordering physician",
        name: input.requestedBy,
        credentials: input.requestedByCredentials,
        imageData: input.requestedByImage,
        note: "Electronically authorised investigation request",
      });
    }

    drawPrintFooter(doc, {
      printedAt,
      printedBy: input.printedBy ?? undefined,
    });
    doc.end();
  });
}
