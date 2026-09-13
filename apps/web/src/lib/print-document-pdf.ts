import type PDFDocument from "pdfkit";

export const PRINT_INK = "#1a1a1a";
export const PRINT_MUTED = "#616161";
export const PRINT_LINE = "#c8c8c8";
export const PRINT_RULE = "#dddddd";
export const PRINT_BOX = "#f7f7f7";

export type PrintHospitalBrand = {
  name: string;
  address?: string | null;
  phone?: string | null;
  logoData?: string | null;
  sealData?: string | null;
};

export type PrintSignoff = {
  role?: string;
  name: string;
  credentials?: string | null;
  imageData?: string | null;
  note?: string | null;
};

export function printClock(date = new Date()) {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function imageFromDataUrl(dataUrl?: string | null) {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!match) return null;
  return {
    format: match[1].toLowerCase().startsWith("png") ? ("png" as const) : ("jpg" as const),
    data: Buffer.from(match[2], "base64"),
  };
}

export function pageWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

export function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom - 72;
  if (doc.y + needed > bottom) doc.addPage();
}

export function drawLetterhead(
  doc: PDFKit.PDFDocument,
  hospital: PrintHospitalBrand,
  opts?: { kicker?: string },
) {
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const top = doc.y;
  const seal = imageFromDataUrl(hospital.sealData ?? hospital.logoData);
  const logo = hospital.sealData ? imageFromDataUrl(hospital.logoData) : null;

  if (seal) {
    try {
      doc.image(seal.data, left, top, { fit: [44, 44] });
    } catch {
      // skip broken branding
    }
  }

  const centerX = left + 56;
  const centerW = width - 56 - 80;
  if (opts?.kicker) {
    doc.font("Helvetica").fontSize(8).fillColor(PRINT_MUTED).text(opts.kicker.toUpperCase(), centerX, top, {
      width: centerW,
    });
  }
  doc.font("Helvetica-Bold").fontSize(15).fillColor(PRINT_INK);
  doc.text(hospital.name.toUpperCase(), centerX, opts?.kicker ? top + 12 : top + 2, { width: centerW });
  doc.font("Helvetica").fontSize(9).fillColor(PRINT_MUTED);
  if (hospital.address) doc.text(hospital.address, centerX, doc.y, { width: centerW });
  if (hospital.phone) doc.text(hospital.phone, centerX, doc.y, { width: centerW });

  if (logo) {
    try {
      doc.image(logo.data, left + width - 72, top, { fit: [72, 44] });
    } catch {
      // skip
    }
  }

  doc.y = Math.max(doc.y, top + 52) + 10;
  doc.x = left;
}

export function drawTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.font("Helvetica-Bold").fontSize(16).fillColor(PRINT_INK).text(title, { align: "center" });
  doc.moveDown(0.45);
}

export function drawIdentity(
  doc: PDFKit.PDFDocument,
  params: {
    patientName: string;
    ageGender: string;
    ids: { label: string; value: string }[];
    meta: { label: string; value: string }[];
  },
) {
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const startY = doc.y;
  const pad = 10;
  const inner = width - pad * 2;
  const idBlock = Math.max(params.ids.length, 1) * 28;
  const boxH = pad + Math.max(36, idBlock) + 10 + 32 + pad;

  doc.save();
  doc.roundedRect(left, startY, width, boxH, 6).fillAndStroke(PRINT_BOX, PRINT_LINE);
  doc.restore();

  let y = startY + pad;
  doc.font("Helvetica-Bold").fontSize(13).fillColor(PRINT_INK);
  doc.text(params.patientName.toUpperCase(), left + pad, y, { width: inner * 0.55 });
  doc.font("Helvetica").fontSize(10).fillColor("#424242");
  doc.text(params.ageGender, left + pad, doc.y, { width: inner * 0.55 });

  let idY = startY + pad;
  const idX = left + pad + inner * 0.58;
  const idW = inner * 0.42;
  for (const field of params.ids) {
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PRINT_MUTED).text(field.label.toUpperCase(), idX, idY, {
      width: idW,
    });
    doc.font("Courier-Bold").fontSize(10).fillColor(PRINT_INK).text(field.value, idX, idY + 10, { width: idW });
    idY += 28;
  }

  y = startY + pad + Math.max(36, idBlock) + 6;
  doc
    .moveTo(left + pad, y)
    .lineTo(left + width - pad, y)
    .strokeColor(PRINT_RULE)
    .stroke();
  y += 8;
  const col = inner / Math.max(params.meta.length, 1);
  params.meta.forEach((field, index) => {
    const x = left + pad + col * index;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PRINT_MUTED).text(field.label.toUpperCase(), x, y, { width: col - 8 });
    doc.font("Helvetica").fontSize(9).fillColor(PRINT_INK).text(field.value, x, y + 10, { width: col - 8 });
  });
  doc.y = startY + boxH + 14;
  doc.x = left;
}

export function drawClinicalRow(doc: PDFKit.PDFDocument, label: string, body: string) {
  ensureSpace(doc, 48);
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const labelW = width * 0.28;
  const bodyW = width * 0.72;
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(PRINT_INK).text(label, left, y, { width: labelW - 8 });
  const labelBottom = doc.y;
  doc.font("Helvetica").fontSize(10).fillColor(PRINT_INK).text(body || "—", left + labelW, y, { width: bodyW, lineGap: 2 });
  doc.y = Math.max(labelBottom, doc.y) + 8;
  doc
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .strokeColor("#eeeeee")
    .stroke();
  doc.y += 8;
  doc.x = left;
}

export function drawVitalsList(doc: PDFKit.PDFDocument, rows: { label: string; value: string }[]) {
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const labelW = width * 0.28;
  const bodyW = width * 0.72;
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(PRINT_INK).text("General examination", left, y, {
    width: labelW - 8,
  });
  let rowY = y;
  for (const row of rows) {
    doc.font("Helvetica").fontSize(9).fillColor(PRINT_MUTED).text(row.label ? `${row.label}:` : "", left + labelW, rowY, {
      width: 90,
    });
    doc.font("Helvetica").fontSize(9).fillColor(PRINT_INK).text(row.value, left + labelW + 94, rowY, {
      width: bodyW - 94,
    });
    rowY += 13;
  }
  doc.y = Math.max(y + 16, rowY) + 6;
  doc
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .strokeColor("#eeeeee")
    .stroke();
  doc.y += 8;
  doc.x = left;
}

export function drawTwoColTable(
  doc: PDFKit.PDFDocument,
  headers: [string, string],
  rows: { left: string; right: string }[],
) {
  ensureSpace(doc, 40);
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const leftW = width * 0.58;
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(PRINT_INK);
  doc.text(headers[0], left, y, { width: leftW });
  doc.text(headers[1], left + leftW, y, { width: width - leftW });
  doc.y = y + 16;
  doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(PRINT_LINE).stroke();
  doc.y += 6;
  const data = rows.length > 0 ? rows : [{ left: "—", right: "—" }];
  for (const row of data) {
    ensureSpace(doc, 20);
    const rowY = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PRINT_INK).text(row.left.toUpperCase(), left, rowY, { width: leftW });
    doc.font("Helvetica").fontSize(9).fillColor(PRINT_INK).text(row.right || "—", left + leftW, rowY, {
      width: width - leftW,
    });
    doc.y = Math.max(doc.y, rowY + 14);
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor("#eeeeee").stroke();
    doc.y += 6;
  }
  doc.x = left;
}

export function drawThreeColTable(
  doc: PDFKit.PDFDocument,
  headers: [string, string, string],
  rows: [string, string, string][],
) {
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const cols = [width * 0.5, width * 0.28, width * 0.22];
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(PRINT_MUTED);
  let x = left;
  headers.forEach((header, i) => {
    doc.text(header.toUpperCase(), x, y, { width: cols[i] });
    x += cols[i];
  });
  doc.y = y + 14;
  doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(PRINT_LINE).stroke();
  doc.y += 6;
  for (const row of rows) {
    ensureSpace(doc, 18);
    const rowY = doc.y;
    x = left;
    row.forEach((value, i) => {
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(i === 1 ? PRINT_MUTED : PRINT_INK);
      doc.text(value, x, rowY, { width: cols[i] });
      x += cols[i];
    });
    doc.y = rowY + 16;
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor("#f1f5f9").stroke();
    doc.y += 4;
  }
  doc.x = left;
}

export function drawSignoff(doc: PDFKit.PDFDocument, sign: PrintSignoff) {
  ensureSpace(doc, 90);
  const width = pageWidth(doc);
  const blockW = 220;
  const x = doc.page.margins.left + width - blockW;
  let y = doc.y + 20;
  if (sign.role) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(PRINT_MUTED).text(sign.role.toUpperCase(), x, y, { width: blockW });
    y = doc.y + 4;
  }
  const image = imageFromDataUrl(sign.imageData);
  if (image) {
    try {
      doc.image(image.data, x, y, { fit: [blockW, 48] });
      y += 52;
    } catch {
      // skip
    }
  }
  doc.font("Helvetica-Bold").fontSize(11).fillColor(PRINT_INK).text(sign.name, x, y, { width: blockW });
  y = doc.y + 2;
  if (sign.credentials) {
    doc.font("Helvetica").fontSize(8).fillColor("#424242").text(sign.credentials, x, y, { width: blockW });
    y = doc.y + 8;
  }
  if (sign.note) {
    doc.moveTo(x, y).lineTo(x + blockW, y).strokeColor("#9e9e9e").stroke();
    doc.font("Helvetica").fontSize(8).fillColor(PRINT_MUTED).text(sign.note, x, y + 4, { width: blockW });
  }
  doc.x = doc.page.margins.left;
}

export function drawPrintFooter(
  doc: PDFKit.PDFDocument,
  params: { printedAt: string; printedBy?: string; confidential?: boolean },
) {
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const y = doc.page.height - doc.page.margins.bottom - 52;
  doc.save();
  if (params.confidential) {
    doc.font("Helvetica").fontSize(8).fillColor(PRINT_MUTED);
    doc.text(
      "This document contains confidential information about your health. It is provided directly to you for your personal use only.",
      left,
      y,
      { width: width },
    );
    doc.font("Helvetica-Bold").fontSize(8).text("E & OE", left, doc.y + 2);
  }
  doc.font("Helvetica").fontSize(8).fillColor(PRINT_MUTED);
  const metaY = doc.page.height - doc.page.margins.bottom - 12;
  if (params.printedBy) {
    doc.text(`Printed by: ${params.printedBy}`, left, metaY, { width: width / 2 });
    doc.text(`Printed on: ${params.printedAt}`, left + width / 2, metaY, { width: width / 2, align: "right" });
  } else {
    doc.text("Page 1/1", left, metaY, { width: width / 2 });
    doc.text(`Printed on: ${params.printedAt}`, left + width / 2, metaY, { width: width / 2, align: "right" });
  }
  doc.restore();
}
