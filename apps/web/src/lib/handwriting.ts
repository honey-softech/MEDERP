export const ENTRY_MODES = ["TYPED", "HANDWRITTEN"] as const;
export type AssessmentEntryMode = (typeof ENTRY_MODES)[number];

export const HANDWRITING_MAX_PAGES = 4;
/** Data-URL length cap for one transparent PNG page. */
export const HANDWRITING_MAX_PAGE_CHARS = 1_200_000;
export const HANDWRITING_MAX_TOTAL_CHARS = 3_600_000;

const PNG_DATA_URL = /^data:image\/png;base64,[a-z0-9+/]+=*$/i;

export function parseEntryMode(value: unknown, fallback: AssessmentEntryMode = "TYPED"): AssessmentEntryMode {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "HANDWRITTEN") return "HANDWRITTEN";
  if (raw === "TYPED") return "TYPED";
  return fallback;
}

export function readHandwritingPages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Drop blank slots. The pad uses this before a page is stored or reloaded. */
export function pagesReadyToStore(pages: Array<string | null | undefined>): string[] {
  return pages.filter((page): page is string => Boolean(page && page.startsWith("data:image/png;base64,")));
}

export function serializeHandwritingPages(pages: string[]): string | null {
  const ready = pagesReadyToStore(pages);
  return ready.length ? JSON.stringify(ready) : null;
}

export function validateHandwritingPages(
  value: unknown,
): { ok: true; pages: string[] } | { ok: false; error: string } {
  const pages = readHandwritingPages(value)
    .map((page) => page.trim())
    .filter(Boolean);
  if (pages.length > HANDWRITING_MAX_PAGES) {
    return { ok: false, error: `A handwritten note can have at most ${HANDWRITING_MAX_PAGES} pages.` };
  }
  let total = 0;
  for (const page of pages) {
    if (!PNG_DATA_URL.test(page)) {
      return { ok: false, error: "Handwritten pages must be PNG images." };
    }
    if (page.length > HANDWRITING_MAX_PAGE_CHARS) {
      return { ok: false, error: "A handwritten page is too large. Clear it and write it again." };
    }
    total += page.length;
  }
  if (total > HANDWRITING_MAX_TOTAL_CHARS) {
    return { ok: false, error: "The handwritten note is too large to save." };
  }
  return { ok: true, pages };
}

export function approveBlockReason(input: {
  entryMode: AssessmentEntryMode;
  diagnosis: string | null;
  handwritingPages: string[];
}): string | null {
  if (input.entryMode === "HANDWRITTEN") {
    return input.handwritingPages.length > 0 ? null : "Write on the sheet before approving.";
  }
  return input.diagnosis?.trim() ? null : "Add a diagnosis before approving.";
}

export function pngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}
