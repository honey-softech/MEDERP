import PDFDocument from "pdfkit";
import { inr, prettyEnum } from "@/lib/front-desk";
import type { ReceiptCollector } from "@/lib/billing/receipt-collector";

const TEAL = "#0f766e";
const SLATE = "#64748b";
const INK = "#0f172a";
const LINE = "#e2e8f0";
const MUTED = "#475569";

export type BillReceiptPdfInput = {
  hospitalName: string;
  issuedAt: Date;
  status: string;
  patientName: string;
  patientMrn: string;
  visitLine?: string | null;
  items: { description: string; amount: { toString(): string } | number }[];
  subtotal: { toString(): string } | number;
  discountAmount: { toString(): string } | number;
  waiverAmount: { toString(): string } | number;
  waiverReason?: string | null;
  showWaiver?: boolean;
  netTotal: { toString(): string } | number;
  paidAmount: { toString(): string } | number;
  payments: {
    kind: string;
    method: string;
    amount: { toString(): string } | number;
    receivedAt: Date;
  }[];
  collector?: ReceiptCollector | null;
};

function when(value: Date) {
  return value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function imageFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!match) return null;
  return {
    format: match[1].toLowerCase().startsWith("png") ? ("png" as const) : ("jpg" as const),
    data: Buffer.from(match[2], "base64"),
  };
}

function moneyLine(
  doc: PDFKit.PDFDocument,
  left: number,
  width: number,
  label: string,
  value: string,
  opts?: { bold?: boolean },
) {
  const y = doc.y;
  doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(INK);
  doc.text(label, left, y, { width: width - 110, continued: false });
  doc.text(value, left + width - 110, y, { width: 110, align: "right" });
  doc.x = left;
  doc.y = y + 16;
}

export async function buildBillReceiptPdf(input: BillReceiptPdfInput): Promise<Buffer> {
  const due = Math.max(0, Number(input.netTotal) - Number(input.paidAmount));
  const showSubtotal =
    Number(input.discountAmount) > 0 || (Boolean(input.showWaiver) && Number(input.waiverAmount) > 0);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startY = doc.y;

    doc.font("Helvetica-Bold").fontSize(9).fillColor(TEAL);
    doc.text(input.hospitalName.toUpperCase(), left, startY, { characterSpacing: 1.4 });
    doc.moveDown(0.35);
    doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text("Receipt / invoice", left);
    doc.font("Helvetica").fontSize(10).fillColor(SLATE);
    doc.text(`${when(input.issuedAt)} · ${prettyEnum(input.status)}`, left);
    doc.moveDown(0.8);

    const col = (width - 16) / 2;
    const blockY = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor(SLATE).text("Patient", left, blockY);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK);
    doc.text(`${input.patientName}  ·  ${input.patientMrn}`, left, blockY + 14, { width: col });
    const patientBottom = doc.y;
    if (input.visitLine) {
      doc.font("Helvetica").fontSize(9).fillColor(SLATE).text("Visit", left + col + 16, blockY);
      doc.font("Helvetica").fontSize(10).fillColor(INK);
      doc.text(input.visitLine, left + col + 16, blockY + 14, { width: col });
    }
    doc.y = Math.max(patientBottom, doc.y) + 16;

    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).stroke(LINE);
    doc.y += 8;
    const headY = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor(SLATE);
    doc.text("Item", left, headY, { width: width - 110 });
    doc.text("Amount", left + width - 110, headY, { width: 110, align: "right" });
    doc.y = headY + 18;

    for (const item of input.items) {
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).stroke("#f1f5f9");
      doc.y += 8;
      moneyLine(doc, left, width, item.description.trim() || "Charge", inr(item.amount));
    }

    doc.moveDown(0.4);
    if (showSubtotal) moneyLine(doc, left, width, "Subtotal", inr(input.subtotal));
    if (Number(input.discountAmount) > 0) {
      moneyLine(doc, left, width, "Discount", `- ${inr(input.discountAmount)}`);
    }
    if (input.showWaiver && Number(input.waiverAmount) > 0) {
      const waiverLabel = input.waiverReason ? `Waiver · ${input.waiverReason}` : "Waiver";
      moneyLine(doc, left, width, waiverLabel, `- ${inr(input.waiverAmount)}`);
    }
    moneyLine(doc, left, width, "Total", inr(input.netTotal), { bold: true });
    moneyLine(doc, left, width, "Paid", inr(input.paidAmount));
    if (due > 0) moneyLine(doc, left, width, "Balance due", inr(due));

    if (input.payments.length > 0) {
      doc.moveDown(0.6);
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).stroke(LINE);
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Payments", left);
      doc.moveDown(0.25);
      for (const payment of input.payments) {
        const line = `${when(payment.receivedAt)} · ${prettyEnum(payment.kind)} · ${prettyEnum(payment.method)} · ${inr(payment.amount)}`;
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(line, left, doc.y, { width });
      }
    }

    if (input.collector) {
      doc.moveDown(1.4);
      const blockWidth = 220;
      const x = left + width - blockWidth;
      let y = doc.y;
      doc.font("Helvetica").fontSize(8).fillColor(SLATE);
      doc.text("RECEIVED BY", x, y, { width: blockWidth });
      y = doc.y + 4;
      const image = input.collector.imageData ? imageFromDataUrl(input.collector.imageData) : null;
      if (image) {
        try {
          doc.image(image.data, x, y, { height: 48, fit: [blockWidth, 48] });
          y += 52;
        } catch {
          // skip a broken signature image
        }
      }
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(input.collector.name, x, y, { width: blockWidth });
      y = doc.y + 2;
      if (input.collector.credentials) {
        doc.font("Helvetica").fontSize(9).fillColor("#424242");
        doc.text(input.collector.credentials, x, y, { width: blockWidth });
        y = doc.y + 8;
      } else {
        y += 10;
      }
      doc.moveTo(x, y).lineTo(x + blockWidth, y).stroke("#9e9e9e");
      doc.font("Helvetica").fontSize(8).fillColor("#616161");
      doc.text("Payment received and receipt issued", x, y + 4, { width: blockWidth });
    }

    const endY = doc.y + 24;
    doc.save();
    doc.roundedRect(left - 16, startY - 16, width + 32, Math.max(endY - startY + 32, 120), 12).stroke(LINE);
    doc.restore();

    doc.end();
  });
}
