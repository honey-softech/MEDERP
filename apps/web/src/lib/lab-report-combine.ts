import { PDFDocument, type PDFImage } from "pdf-lib";
import { isAllowedLabReport } from "@/lib/lab-report-store";

export type LabReportSourceFile = {
  name: string;
  mimeType: string;
  bytes: Buffer;
};

/** Combined multi-page reports can be larger than a single upload. */
export const LAB_REPORT_COMBINED_MAX_BYTES = 24 * 1024 * 1024;

export function isAllowedLabReportPage(mimeType: string, size: number) {
  return isAllowedLabReport(mimeType, size);
}

/**
 * Build one PDF from one or more uploaded pages/files.
 * - Images (JPEG/PNG) each become a page.
 * - PDFs are merged in order.
 * - WebP is only allowed as a single-file upload (not combined).
 */
export async function combineLabReportFiles(files: LabReportSourceFile[]): Promise<{
  bytes: Buffer;
  fileName: string;
  mimeType: string;
}> {
  if (files.length === 0) {
    throw new Error("Choose at least one PDF or image to upload.");
  }

  if (files.length === 1) {
    const only = files[0]!;
    if (only.mimeType === "image/webp" || only.mimeType === "application/pdf") {
      return {
        bytes: only.bytes,
        fileName: sanitizeCombinedName(only.name, only.mimeType),
        mimeType: only.mimeType,
      };
    }
  }

  if (files.some((file) => file.mimeType === "image/webp")) {
    throw new Error("WebP cannot be combined into a multi-page report. Upload JPG, PNG, or PDF pages.");
  }

  const out = await PDFDocument.create();

  for (const file of files) {
    if (file.mimeType === "application/pdf") {
      const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      for (const page of pages) out.addPage(page);
      continue;
    }

    if (file.mimeType === "image/jpeg" || file.mimeType === "image/jpg") {
      const image = await out.embedJpg(file.bytes);
      addImagePage(out, image);
      continue;
    }

    if (file.mimeType === "image/png") {
      const image = await out.embedPng(file.bytes);
      addImagePage(out, image);
      continue;
    }

    throw new Error(`Unsupported report type: ${file.mimeType}`);
  }

  if (out.getPageCount() === 0) {
    throw new Error("Could not build a report from the selected files.");
  }

  const bytes = Buffer.from(await out.save());
  if (bytes.length > LAB_REPORT_COMBINED_MAX_BYTES) {
    throw new Error("Combined report is too large. Use fewer pages or smaller images.");
  }

  return {
    bytes,
    fileName: files.length === 1 ? sanitizeCombinedName(files[0]!.name, "application/pdf") : "lab-report.pdf",
    mimeType: "application/pdf",
  };
}

function addImagePage(doc: PDFDocument, image: PDFImage) {
  const maxW = 595;
  const maxH = 842;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const pageW = Math.max(1, Math.round(image.width * scale));
  const pageH = Math.max(1, Math.round(image.height * scale));
  const page = doc.addPage([pageW, pageH]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: pageW,
    height: pageH,
  });
}

function sanitizeCombinedName(name: string, mimeType: string) {
  const trimmed = name.replace(/[/\\]/g, "").trim().slice(0, 160);
  if (mimeType === "application/pdf") {
    return trimmed.toLowerCase().endsWith(".pdf") ? trimmed || "lab-report.pdf" : `${trimmed || "lab-report"}.pdf`;
  }
  const base = trimmed.replace(/\.(jpe?g|png|webp)$/i, "") || "lab-report";
  return `${base}.pdf`;
}

export function assertLabReportSources(files: LabReportSourceFile[]) {
  if (files.length === 0) {
    return "Choose a PDF or image to upload.";
  }
  for (const file of files) {
    if (!isAllowedLabReportPage(file.mimeType, file.bytes.length)) {
      return "Upload PDF, JPG, or PNG files up to 8 MB each.";
    }
  }
  const total = files.reduce((sum, file) => sum + file.bytes.length, 0);
  if (total > LAB_REPORT_COMBINED_MAX_BYTES) {
    return "Selected files are too large combined. Use fewer pages or smaller images.";
  }
  if (files.length > 30) {
    return "You can upload up to 30 pages/files at once.";
  }
  return null;
}
