export type AuditChange = {
  field: string;
  previous: string | null;
  next: string | null;
};

const DEFAULT_REDACT_FIELDS = new Set([
  "passwordHash",
  "password",
  "photoData",
  "logoData",
  "sealData",
  "imageData",
]);

const OMIT_ALWAYS = new Set(["id", "hospitalId", "createdAt", "updatedAt"]);

function auditValue(value: unknown, redact: boolean): string | null {
  if (redact) {
    if (value == null || value === "") return null;
    return "updated";
  }
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "object" && value !== null && Object.getPrototypeOf(value)?.constructor?.name === "Decimal") {
    return String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function parseAuditChanges(metadata: unknown): AuditChange[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const raw = (metadata as { changes?: unknown }).changes;
  if (!Array.isArray(raw)) return [];
  const changes: AuditChange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const field = String((item as { field?: unknown }).field ?? "").trim();
    if (!field) continue;
    const previous = (item as { previous?: unknown }).previous;
    const next = (item as { next?: unknown }).next;
    changes.push({
      field,
      previous: previous == null ? null : String(previous),
      next: next == null ? null : String(next),
    });
  }
  return changes;
}

function isBlank(value: unknown): boolean {
  return value == null || value === "";
}

export function diffAuditFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  options?: {
    fields?: string[];
    omit?: string[];
    redact?: string[];
  },
): AuditChange[] {
  const omit = new Set([...(options?.omit ?? []), ...OMIT_ALWAYS]);
  const redact = new Set([...(options?.redact ?? []), ...DEFAULT_REDACT_FIELDS]);
  const keys = options?.fields?.length
    ? options.fields
    : [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];

  const changes: AuditChange[] = [];
  for (const field of keys) {
    if (omit.has(field)) continue;
    const beforeVal = before?.[field];
    const afterVal = after?.[field];
    if (redact.has(field)) {
      if (isBlank(beforeVal) && isBlank(afterVal)) continue;
      if (beforeVal === afterVal) continue;
      changes.push({
        field,
        previous: isBlank(beforeVal) ? null : "updated",
        next: isBlank(afterVal) ? null : "updated",
      });
      continue;
    }
    const previous = auditValue(beforeVal, false);
    const next = auditValue(afterVal, false);
    if (previous === next) continue;
    changes.push({ field, previous, next });
  }
  return changes;
}
