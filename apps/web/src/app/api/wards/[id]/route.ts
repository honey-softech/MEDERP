import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import {
  WARD_MASTER_ROLES,
  assertWardsModuleEnabled,
  isGenderPolicy,
  isWardType,
  updateWard,
  wardErrorResponse,
} from "@/lib/wards";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
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
  const typeRaw = body?.type != null ? String(body.type) : undefined;
  const genderRaw = body?.genderPolicy != null ? String(body.genderPolicy) : undefined;
  if (typeRaw && !isWardType(typeRaw)) {
    return NextResponse.json({ error: "Invalid ward type." }, { status: 400 });
  }
  if (genderRaw && !isGenderPolicy(genderRaw)) {
    return NextResponse.json({ error: "Invalid gender policy." }, { status: 400 });
  }
  const type = typeRaw && isWardType(typeRaw) ? typeRaw : undefined;
  const genderPolicy = genderRaw && isGenderPolicy(genderRaw) ? genderRaw : undefined;

  try {
    const ward = await updateWard({
      hospitalId: scoped.user.hospitalId,
      wardId: id,
      name: body?.name != null ? String(body.name) : undefined,
      departmentId: body?.departmentId != null ? String(body.departmentId) : undefined,
      type,
      genderPolicy,
      floor: body?.floor !== undefined ? String(body.floor ?? "") : undefined,
      dailyRate: body?.dailyRate != null ? Number(body.dailyRate) : undefined,
      nursingRate: body?.nursingRate != null ? Number(body.nursingRate) : undefined,
      isActive: body?.isActive != null ? Boolean(body.isActive) : undefined,
      notes: body?.notes !== undefined ? String(body.notes ?? "") : undefined,
    });
    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "WARD_UPDATED",
      entity: "Ward",
      entityId: ward.id,
      summary: `${scoped.user.username} updated ward ${ward.name}.`,
    });
    return NextResponse.json({ ward });
  } catch (error) {
    return wardErrorResponse(error);
  }
}
