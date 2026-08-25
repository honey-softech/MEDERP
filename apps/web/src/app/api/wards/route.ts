import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import {
  WARD_MASTER_ROLES,
  WARD_VIEW_ROLES,
  assertWardsModuleEnabled,
  createWard,
  isGenderPolicy,
  isWardType,
  seedHospitalWards,
  wardErrorResponse,
} from "@/lib/wards";

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, WARD_VIEW_ROLES);
  if (denied) return denied;

  try {
    await assertWardsModuleEnabled(scoped.user.hospitalId);
  } catch (error) {
    return wardErrorResponse(error);
  }

  await seedHospitalWards(scoped.user.hospitalId);

  const wards = await prisma.ward.findMany({
    where: { hospitalId: scoped.user.hospitalId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      department: true,
      beds: {
        orderBy: { number: "asc" },
        include: {
          admissions: {
            where: { status: { in: ["ADMITTED", "DISCHARGE_ADVISED"] } },
            include: { patient: true },
            take: 1,
          },
        },
      },
    },
  });

  return NextResponse.json({ wards });
}

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
  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const departmentId = String(body?.departmentId ?? "");
  const type = String(body?.type ?? "GENERAL");
  const genderPolicy = String(body?.genderPolicy ?? "MIXED");
  if (!name || !code || !departmentId) {
    return NextResponse.json({ error: "Ward name, code, and department are required." }, { status: 400 });
  }
  if (!isWardType(type) || !isGenderPolicy(genderPolicy)) {
    return NextResponse.json({ error: "Invalid ward type or gender policy." }, { status: 400 });
  }

  try {
    const ward = await createWard({
      hospitalId: scoped.user.hospitalId,
      departmentId,
      name,
      code,
      type,
      genderPolicy,
      floor: body?.floor != null ? String(body.floor) : null,
      dailyRate: Number(body?.dailyRate ?? 0),
      nursingRate: Number(body?.nursingRate ?? 0),
      notes: body?.notes != null ? String(body.notes) : null,
    });
    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "WARD_CREATED",
      entity: "Ward",
      entityId: ward.id,
      summary: `${scoped.user.username} created ward ${ward.name} (${ward.code}).`,
    });
    return NextResponse.json({ ward });
  } catch (error) {
    return wardErrorResponse(error);
  }
}
