import type { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditChange } from "@/lib/audit-changes";
import { diffAuditFields, parseAuditChanges } from "@/lib/audit-changes";

export type { AuditChange };
export { diffAuditFields, parseAuditChanges };

export function clientIp(request?: Request) {
  if (!request) return null;
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export async function writeAuditLog(entry: {
  hospitalId?: string | null;
  actorUserId?: string | null;
  actorUsername: string;
  actorRole?: AppRole | string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        hospitalId: entry.hospitalId ?? null,
        actorUserId: entry.actorUserId ?? null,
        actorUsername: entry.actorUsername,
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        metadata: {
          ...(entry.metadata ?? {}),
          ip: clientIp(entry.request),
        },
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
