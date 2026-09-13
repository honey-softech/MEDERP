import PDFDocument from "pdfkit";
import { physicianLine, tokenLabel } from "@/lib/front-desk";
import { ageGenderLine, visitDateLabel } from "@/lib/visit-summary";

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
};

export async function buildInvestigationListPdf(input: InvestigationListPdfInput): Promise<Buffer> {
  const patientName = `${input.patient.firstName} ${input.patient.lastName}`.trim().toUpperCase();
  const hasOutside = input.items.some((item) => item.outside);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.font("Helvetica-Bold").fontSize(16).text(input.hospital.name, { align: "center" });
    doc.font("Helvetica").fontSize(9);
    if (input.hospital.address) doc.text(input.hospital.address, { align: "center" });
    if (input.hospital.phone) doc.text(`Phone: ${input.hospital.phone}`, { align: "center" });
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).text("Investigation request", { align: "center" });
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(10);
    const meta = [
      `Patient: ${patientName}`,
      `MRN: ${input.patient.mrn}`,
      `Age / Gender: ${ageGenderLine(input.patient.dateOfBirth, input.patient.gender)}`,
      ...(input.patient.phone ? [`Phone: ${input.patient.phone}`] : []),
      `Physician: ${physicianLine(input.doctor)}`,
      `Department: ${input.departmentName}`,
      `Visit: ${visitDateLabel(input.scheduledAt)}${input.tokenNumber ? ` · Token ${tokenLabel(input.tokenNumber)}` : ""}`,
    ];
    for (const line of meta) doc.text(line);

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(11).text("Tests / scans");
    doc.moveDown(0.3);

    const cols = [
      { label: "Test / scan", width: contentWidth * 0.5 },
      { label: "Category", width: contentWidth * 0.28 },
      { label: "Where", width: contentWidth * 0.22 },
    ];
    let x = doc.page.margins.left;
    const headerY = doc.y;
    doc.font("Helvetica-Bold").fontSize(9);
    for (const col of cols) {
      doc.text(col.label, x, headerY, { width: col.width });
      x += col.width;
    }
    doc.y = headerY + 16;
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + contentWidth, doc.y)
      .strokeColor("#cbd5e1")
      .stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(10).fillColor("#000000");
    for (const item of input.items) {
      const rowY = doc.y;
      const values = [item.name, item.category, item.outside ? "Outside" : "Hospital lab"];
      x = doc.page.margins.left;
      let rowHeight = 14;
      for (let i = 0; i < cols.length; i += 1) {
        const height = doc.heightOfString(values[i], { width: cols[i].width });
        rowHeight = Math.max(rowHeight, height);
        doc.text(values[i], x, rowY, { width: cols[i].width });
        x += cols[i].width;
      }
      doc.y = rowY + rowHeight + 6;
      doc.x = doc.page.margins.left;
    }

    if (hasOutside) {
      doc.moveDown(0.4);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#334155")
        .text("Complete outside tests and bring the reports to the hospital.");
      doc.fillColor("#000000");
    }

    if (input.requestedBy) {
      doc.moveDown(1);
      doc.font("Helvetica").fontSize(10).text(`Requested by: ${input.requestedBy}`);
      if (input.requestedByCredentials) {
        doc.text(input.requestedByCredentials);
      }
    }

    doc.moveDown(1.2);
    doc.fontSize(8).fillColor("#666666").text(`Generated ${new Date().toLocaleString("en-IN")} · MedERP`, {
      align: "center",
    });

    doc.end();
  });
}
