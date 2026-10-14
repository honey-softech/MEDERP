import { parseAuditChanges } from "@/lib/audit-changes";
import { prisma } from "@/lib/prisma";

/** Human label stored on medicine-brand audit revisions. */
export function formatBrandAuditValue(names: string[]) {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  return unique.length === 0 ? "None" : unique.join(", ");
}

/** Stored revisions keep a JSON array of manufacturer ids. Names written later are plain text. */
export function parseStoredManufacturerIds(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function labelManufacturerIdList(value: string | null, names: Map<string, string>) {
  const ids = parseStoredManufacturerIds(value);
  if (!ids) return value;
  return formatBrandAuditValue(ids.map((id) => names.get(id) ?? id));
}

type AuditLogLike = { metadata: unknown };

/** Replace manufacturer ids in existing revisions with brand names. */
export async function labelMedicineBrandsInAuditLogs<T extends AuditLogLike>(logs: T[]): Promise<T[]> {
  const ids = new Set<string>();
  for (const log of logs) {
    for (const change of parseAuditChanges(log.metadata)) {
      if (change.field !== "manufacturerIds") continue;
      for (const value of [change.previous, change.next]) {
        for (const id of parseStoredManufacturerIds(value) ?? []) ids.add(id);
      }
    }
  }
  if (ids.size === 0) return logs;

  const rows = await prisma.drugManufacturer.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true },
  });
  const names = new Map(rows.map((row) => [row.id, row.name]));

  return logs.map((log) => {
    const changes = parseAuditChanges(log.metadata);
    if (!changes.some((change) => change.field === "manufacturerIds")) return log;
    const metadata =
      log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
        ? { ...(log.metadata as Record<string, unknown>) }
        : {};
    metadata.changes = changes.map((change) =>
      change.field === "manufacturerIds"
        ? {
            ...change,
            previous: labelManufacturerIdList(change.previous, names),
            next: labelManufacturerIdList(change.next, names),
          }
        : change,
    );
    return { ...log, metadata };
  });
}
