import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { WARD_MASTER_ROLES, addBeds, assertWardsModuleEnabled, isBedType, wardErrorResponse } from "@/lib/wards";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, WARD_MASTER_ROLES);
  if (denied) return denied;

  try {
    await assertWardsModuleEnabled(scoped.user.hospitalId);
  } catch (error) {
    return wardErrorResponse(error);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const count = Number(body?.count ?? 0);
  const type = String(body?.type ?? "GENERAL");
  if (!isBedType(type)) {
    return NextResponse.json({ error: "Invalid bed type." }, { status: 400 });
  }

  try {
    const created = await addBeds({
      hospitalId: scoped.user.hospitalId,
      wardId: id,
      count,
      startNumber: body?.startNumber != null ? Number(body.startNumber) : undefined,
      prefix: body?.prefix != null ? String(body.prefix) : null,
      type,
      room: body?.room != null ? String(body.room) : null,
    });
    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "BEDS_ADDED",
      entity: "Ward",
      entityId: id,
      summary: `${scoped.user.username} added ${created} bed(s) to a ward.`,
      metadata: { count: created },
    });
    return NextResponse.json({ created });
  } catch (error) {
    return wardErrorResponse(error);
  }
}
