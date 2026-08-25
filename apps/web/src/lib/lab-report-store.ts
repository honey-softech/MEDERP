import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const REPORT_ROOT = path.join(process.cwd(), "uploads", "lab-reports");
const SAFE_ID = /^[a-z0-9_-]+$/i;

export const LAB_REPORT_MAX_BYTES = 8 * 1024 * 1024;
export const LAB_REPORT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export function isAllowedLabReport(mimeType: string, size: number) {
  return LAB_REPORT_MIME_TYPES.includes(mimeType as (typeof LAB_REPORT_MIME_TYPES)[number]) && size > 0 && size <= LAB_REPORT_MAX_BYTES;
}

function safeSegment(value: string) {
  return SAFE_ID.test(value) ? value : null;
}

export function labReportFilePath(hospitalId: string, orderId: string) {
  const hospital = safeSegment(hospitalId);
  const order = safeSegment(orderId);
  if (!hospital || !order) return null;
  return path.join(REPORT_ROOT, hospital, order);
}

export async function saveLabReportFile(hospitalId: string, orderId: string, bytes: Buffer) {
  const filePath = labReportFilePath(hospitalId, orderId);
  if (!filePath) throw new Error("Invalid lab report path.");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  return filePath;
}

export async function readLabReportFile(hospitalId: string, orderId: string) {
  const filePath = labReportFilePath(hospitalId, orderId);
  if (!filePath) return null;
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export function sanitizeReportFileName(name: string) {
  const trimmed = name.replace(/[/\\]/g, "").trim().slice(0, 180);
  return trimmed || "lab-report.pdf";
}
