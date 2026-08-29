import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { WARD_HOUSEKEEPING_ROLES, assertWardsModuleEnabled, updateBedStatus, wardErrorResponse } from "@/lib/wards";

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS = ["ready", "maintenance", "block", "unblock"] as const;

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, WARD_HOUSEKEEPING_ROLES);
  if (denied) return denied;

  try {
    await assertWardsModuleEnabled(scoped.user.hospitalId);
  } catch (error) {
    return wardErrorResponse(error);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "") as (typeof ACTIONS)[number];
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Unknown bed action." }, { status: 400 });
  }

  try {
    const existing = await prisma.bed.findFirst({
      where: { id, hospitalId: scoped.user.hospitalId },
      select: { status: true, isActive: true },
    });
    const bed = await updateBedStatus({
      hospitalId: scoped.user.hospitalId,
      bedId: id,
      action,
    });
    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "BED_STATUS_CHANGED",
      entity: "Bed",
      entityId: bed.id,
      summary: `${scoped.user.username} set bed ${bed.number} to ${bed.status.toLowerCase()}.`,
      metadata: {
        changes: diffAuditFields(
          { status: existing?.status, isActive: existing?.isActive },
          { status: bed.status, isActive: bed.isActive },
          { fields: ["status", "isActive"] },
        ),
      },
    });
    return NextResponse.json({ bed });
  } catch (error) {
    return wardErrorResponse(error);
  }
}
