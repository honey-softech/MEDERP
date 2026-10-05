export const EXTRA_PHONE_KINDS = ["landline", "mobile", "other"] as const;

export type ExtraPhoneKind = (typeof EXTRA_PHONE_KINDS)[number];

export type ExtraPhone = {
  kind: ExtraPhoneKind;
  number: string;
};

const KIND_LABEL: Record<ExtraPhoneKind, string> = {
  landline: "Landline",
  mobile: "Mobile",
  other: "Phone",
};

function kindOf(value: unknown): ExtraPhoneKind | null {
  const raw = String(value ?? "landline").toLowerCase();
  if (raw === "landline") return "landline";
  if (raw === "mobile") return "mobile";
  if (raw === "other" || raw === "phone") return "other";
  return null;
}

export function extraPhoneLabel(kind: ExtraPhoneKind) {
  return KIND_LABEL[kind];
}

/** Reads stored JSON or older one-number-per-line text. */
export function parseExtraPhones(raw: unknown): ExtraPhone[] {
  if (Array.isArray(raw)) return rowsFromUnknown(raw);
  const text = String(raw ?? "").trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return rowsFromUnknown(parsed);
    } catch {
      // fall through to plain lines
    }
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => {
      const match = line.match(/^(landline|mobile|phone)\s*[:\-]\s*(.+)$/i);
      if (!match) return { kind: "landline" as const, number: line.slice(0, 40) };
      const kind = kindOf(match[1]) ?? "landline";
      return { kind, number: match[2].trim().slice(0, 40) };
    })
    .filter((row) => row.number);
}

function rowsFromUnknown(rows: unknown[]): ExtraPhone[] {
  const out: ExtraPhone[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const kind = kindOf((row as { kind?: unknown }).kind) ?? "landline";
    const number = String((row as { number?: unknown }).number ?? "").trim();
    if (!number) continue;
    out.push({ kind, number: number.slice(0, 40) });
    if (out.length >= 8) break;
  }
  return out;
}

export function extraPhonesForStorage(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, value: null };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Phone numbers are not in the right format." };
  }
  if (raw.length > 8) {
    return { ok: false, error: "Add at most 8 extra phone numbers." };
  }
  const rows: ExtraPhone[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const kind = kindOf((row as { kind?: unknown }).kind);
    if (!kind) return { ok: false, error: "Choose landline, mobile, or other for each number." };
    const number = String((row as { number?: unknown }).number ?? "").trim();
    if (!number) continue;
    if (number.length > 40 || !/^[\d+\-().\s]{3,40}$/.test(number)) {
      return {
        ok: false,
        error: "Each number should be 3–40 characters, using digits, spaces, and + - ( ).",
      };
    }
    rows.push({ kind, number });
  }
  return { ok: true, value: rows.length ? JSON.stringify(rows) : null };
}

function lineKey(line: string) {
  const digits = line.replace(/\D/g, "");
  if (digits.length >= 6) return digits;
  return line.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Primary mobile plus landlines and other numbers, one line each, without duplicates. */
export function letterheadPhoneLines(phone?: string | null, altPhones?: unknown): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  function push(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    const key = lineKey(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(trimmed);
  }
  for (const line of String(phone ?? "").split(/\r?\n/)) push(line);
  for (const row of parseExtraPhones(altPhones)) {
    push(`${extraPhoneLabel(row.kind)}: ${row.number}`);
  }
  return lines;
}

export function letterheadPhoneText(phone?: string | null, altPhones?: unknown) {
  const lines = letterheadPhoneLines(phone, altPhones);
  return lines.length ? lines.join("\n") : null;
}
