import PDFDocument from "pdfkit";
import { inr } from "@/lib/display";
import {
  PRINT_INK,
  PRINT_LINE,
  PRINT_MUTED,
  PRINT_RULE,
  drawPrintFooter,
  pageWidth,
  printClock,
} from "@/lib/print-document-pdf";

export type PlatformInvoicePdfInput = {
  companyName: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  gstin?: string | null;
  bankDetails?: string | null;
  termsNote?: string | null;
  invoiceNo: string;
  issuedAt: Date;
  paidAt?: Date | null;
  status: string;
  paymentMethod?: string | null;
  notes?: string | null;
  hospitalName: string;
  hospitalCode: string;
  hospitalAddress?: string | null;
  hospitalPhone?: string | null;
  billedToName?: string | null;
  billedToMobile?: string | null;
  periodLabel?: string | null;
  items: { description: string; amount: { toString(): string } | number }[];
  netTotal: { toString(): string } | number;
};

function money(value: { toString(): string } | number) {
  return inr(value);
}

export function subscriptionBillFilename(invoiceNo: string) {
  return `subscription-${invoiceNo.replace(/[^\w.-]+/g, "_")}.pdf`;
}

export async function buildPlatformInvoicePdf(input: PlatformInvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = pageWidth(doc);
    const contact = [input.companyPhone, input.companyEmail, input.gstin ? `GSTIN ${input.gstin}` : null]
      .filter(Boolean)
      .join(" · ");

    doc.font("Helvetica-Bold").fontSize(16).fillColor(PRINT_INK).text(input.companyName, left, doc.y, {
      width: width * 0.62,
    });
    if (input.companyAddress) {
      doc.font("Helvetica").fontSize(9).fillColor(PRINT_MUTED).text(input.companyAddress, { width: width * 0.62 });
    }
    if (contact) {
      doc.font("Helvetica").fontSize(9).fillColor(PRINT_MUTED).text(contact, { width: width * 0.62 });
    }

    const rightX = left + width * 0.62;
    const headerTop = 48;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(PRINT_INK).text("TAX INVOICE", rightX, headerTop, {
      width: width * 0.38,
      align: "right",
    });
    doc.font("Courier-Bold").fontSize(10).text(input.invoiceNo, rightX, doc.y, { width: width * 0.38, align: "right" });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(PRINT_MUTED)
      .text(input.issuedAt.toLocaleDateString("en-IN", { dateStyle: "medium" }), rightX, doc.y, {
        width: width * 0.38,
        align: "right",
      });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(PRINT_INK).text(input.status, rightX, doc.y, {
      width: width * 0.38,
      align: "right",
    });

    doc.y = Math.max(doc.y, 130);
    doc.x = left;
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(PRINT_LINE).stroke();
    doc.y += 14;

    const colW = width / 2 - 8;
    const billY = doc.y;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PRINT_MUTED).text("BILL TO", left, billY, { width: colW });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(PRINT_INK).text(input.hospitalName, left, doc.y, { width: colW });
    doc.font("Courier").fontSize(9).fillColor(PRINT_MUTED).text(input.hospitalCode, { width: colW });
    if (input.hospitalAddress) {
      doc.font("Helvetica").fontSize(9).fillColor(PRINT_MUTED).text(input.hospitalAddress, { width: colW });
    }
    if (input.hospitalPhone) {
      doc.font("Helvetica").fontSize(9).fillColor(PRINT_MUTED).text(input.hospitalPhone, { width: colW });
    }
    if (input.billedToName) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(PRINT_INK)
        .text(`Admin: ${input.billedToName}${input.billedToMobile ? ` · ${input.billedToMobile}` : ""}`, {
          width: colW,
        });
    }
    const leftBottom = doc.y;

    doc.font("Helvetica-Bold").fontSize(7).fillColor(PRINT_MUTED).text("PAYMENT", left + width / 2 + 8, billY, {
      width: colW,
    });
    doc.font("Helvetica").fontSize(10).fillColor(PRINT_INK).text(input.paymentMethod ?? "—", { width: colW });
    if (input.paidAt) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(PRINT_MUTED)
        .text(`Paid ${input.paidAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`, { width: colW });
    }
    if (input.periodLabel) {
      doc.font("Helvetica").fontSize(9).fillColor(PRINT_MUTED).text(`Period ${input.periodLabel}`, { width: colW });
    }
    if (input.notes) {
      doc.font("Helvetica").fontSize(8).fillColor(PRINT_MUTED).text(input.notes, { width: colW });
    }
    doc.y = Math.max(leftBottom, doc.y) + 18;
    doc.x = left;

    doc.font("Helvetica-Bold").fontSize(8).fillColor(PRINT_MUTED);
    doc.text("DESCRIPTION", left, doc.y, { width: width - 110 });
    doc.text("AMOUNT", left + width - 110, doc.y, { width: 110, align: "right" });
    doc.y += 16;
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(PRINT_LINE).stroke();
    doc.y += 8;

    for (const item of input.items) {
      const rowY = doc.y;
      doc.font("Helvetica").fontSize(10).fillColor(PRINT_INK).text(item.description, left, rowY, { width: width - 120 });
      doc.text(money(item.amount), left + width - 110, rowY, { width: 110, align: "right" });
      doc.y = Math.max(doc.y, rowY + 18);
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(PRINT_RULE).stroke();
      doc.y += 8;
    }

    doc.font("Helvetica-Bold").fontSize(11).fillColor(PRINT_INK);
    const totalY = doc.y + 6;
    doc.text("Total", left, totalY, { width: width - 120 });
    doc.text(money(input.netTotal), left + width - 110, totalY, { width: 110, align: "right" });
    doc.y = totalY + 24;
    doc.x = left;

    if (input.bankDetails) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(PRINT_INK).text("Bank / UPI");
      doc.font("Helvetica").fontSize(9).fillColor(PRINT_MUTED).text(input.bankDetails, { width });
      doc.moveDown(0.4);
    }
    if (input.termsNote) {
      doc.font("Helvetica").fontSize(8).fillColor(PRINT_MUTED).text(input.termsNote, { width });
    }

    drawPrintFooter(doc, { printedAt: printClock() });
    doc.end();
  });
}
