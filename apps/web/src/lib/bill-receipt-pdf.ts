import PDFDocument from "pdfkit";
import { inr, prettyEnum } from "@/lib/front-desk";

export type BillReceiptPdfInput = {
  hospital: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  patient: {
    firstName: string;
    lastName: string;
    mrn: string;
  };
  invoiceNo: string;
  status: string;
  issuedAt: Date;
  items: { description: string; amount: { toString(): string } | number }[];
  subtotal: { toString(): string } | number;
  discountAmount: { toString(): string } | number;
  waiverAmount: { toString(): string } | number;
  netTotal: { toString(): string } | number;
  paidAmount: { toString(): string } | number;
  payments: {
    method: string;
    amount: { toString(): string } | number;
    receivedAt: Date;
  }[];
  visitLine?: string | null;
};

function moneyRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  opts?: { bold?: boolean; contentWidth?: number },
) {
  const contentWidth =
    opts?.contentWidth ?? doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
  doc.text(label, { width: contentWidth - 100 });
  doc.text(value, doc.page.margins.left + contentWidth - 90, y, { width: 90, align: "right" });
  doc.x = doc.page.margins.left;
}

export async function buildBillReceiptPdf(input: BillReceiptPdfInput): Promise<Buffer> {
  const patientName = `${input.patient.firstName} ${input.patient.lastName}`.trim().toUpperCase();
  const due = Math.max(0, Number(input.netTotal) - Number(input.paidAmount));

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
    doc.font("Helvetica-Bold").fontSize(12).text("Receipt / invoice", { align: "center" });
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(10);
    for (const line of [
      `Invoice: ${input.invoiceNo}`,
      `Status: ${prettyEnum(input.status)}`,
      `Issued: ${input.issuedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
      `Patient: ${patientName}`,
      `MRN: ${input.patient.mrn}`,
      ...(input.visitLine ? [`Visit: ${input.visitLine}`] : []),
    ]) {
      doc.text(line);
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(11).text("Charges");
    doc.moveDown(0.3);
    for (const item of input.items) {
      moneyRow(doc, item.description.trim() || "Charge", inr(item.amount), { contentWidth });
    }

    doc.moveDown(0.5);
    moneyRow(doc, "Subtotal", inr(input.subtotal), { contentWidth });
    if (Number(input.discountAmount) > 0) {
      moneyRow(doc, "Discount", `−${inr(input.discountAmount)}`, { contentWidth });
    }
    if (Number(input.waiverAmount) > 0) {
      moneyRow(doc, "Waiver", `−${inr(input.waiverAmount)}`, { contentWidth });
    }
    moneyRow(doc, "Net total", inr(input.netTotal), { bold: true, contentWidth });
    moneyRow(doc, "Paid", inr(input.paidAmount), { contentWidth });
    moneyRow(doc, "Due", inr(due), { bold: true, contentWidth });

    if (input.payments.length > 0) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(11).text("Payments");
      doc.moveDown(0.3);
      for (const payment of input.payments) {
        const when = payment.receivedAt.toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        });
        moneyRow(doc, `${prettyEnum(payment.method)} · ${when}`, inr(payment.amount), {
          contentWidth,
        });
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
