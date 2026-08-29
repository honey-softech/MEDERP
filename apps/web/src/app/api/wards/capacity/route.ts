import { NextResponse } from "next/server";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import {
  STANDARD_WARD_CODES,
  WARD_MASTER_ROLES,
  assertWardsModuleEnabled,
  isStandardWardCode,
  setStandardWardCapacity,
  wardErrorResponse,
  type StandardWardCode,
} from "@/lib/wards";

export async function POST(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, WARD_MASTER_ROLES);
  if (denied) return denied;

  try {
    await assertWardsModuleEnabled(scoped.user.hospitalId);
  } catch (error) {
    return wardErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const counts: Partial<Record<StandardWardCode, number>> = {};
  for (const code of STANDARD_WARD_CODES) {
    if (!isStandardWardCode(code)) continue;
    const raw = body?.[code] ?? body?.counts?.[code];
    if (raw == null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: `Invalid count for ${code}.` }, { status: 400 });
    }
    counts[code] = value;
  }
  if (Object.keys(counts).length === 0) {
    return NextResponse.json({ error: "Provide at least one ward capacity count." }, { status: 400 });
  }

  try {
    const results = await setStandardWardCapacity({
      hospitalId: scoped.user.hospitalId,
      counts,
    });
    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "WARD_CAPACITY_SET",
      entity: "Ward",
      entityId: scoped.user.hospitalId,
      summary: `${scoped.user.username} updated hospital ward room/bed capacity.`,
      metadata: {
        counts,
        results,
        changes: diffAuditFields({ counts: null }, { counts }, { fields: ["counts"] }),
      },
    });
    return NextResponse.json({ results });
  } catch (error) {
    return wardErrorResponse(error);
  }
}
