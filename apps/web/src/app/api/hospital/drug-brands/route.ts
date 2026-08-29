import { NextRequest, NextResponse } from "next/server";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { listManufacturersForPicker } from "@/lib/drug-brands";
import { requireHospitalActor, forbidUnless } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, ["SUPER_ADMIN"]);
  if (denied) return denied;

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const selected = await prisma.hospitalDrugManufacturer.findMany({
    where: { hospitalId: scoped.user.hospitalId },
    include: { manufacturer: { select: { id: true, name: true, medicineCount: true } } },
    orderBy: { manufacturer: { name: "asc" } },
  });

  const suggestions = await listManufacturersForPicker(q, 40);

  return NextResponse.json({
    selected: selected.map((row) => row.manufacturer),
    suggestions,
  });
}

export async function PUT(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, ["SUPER_ADMIN"]);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { manufacturerIds?: unknown } | null;
  const ids = Array.isArray(body?.manufacturerIds)
    ? [...new Set(body.manufacturerIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
    : null;

  if (!ids) {
    return NextResponse.json({ error: "manufacturerIds array required." }, { status: 400 });
  }

  if (ids.length > 0) {
    const found = await prisma.drugManufacturer.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      return NextResponse.json({ error: "One or more manufacturers were not found." }, { status: 400 });
    }
  }

  const hospitalId = scoped.user.hospitalId;
  const previous = await prisma.hospitalDrugManufacturer.findMany({
    where: { hospitalId },
    select: { manufacturerId: true },
  });
  const previousIds = previous.map((row) => row.manufacturerId).sort();
  const nextIds = [...ids].sort();

  await prisma.$transaction(async (tx) => {
    await tx.hospitalDrugManufacturer.deleteMany({ where: { hospitalId } });
    if (ids.length > 0) {
      await tx.hospitalDrugManufacturer.createMany({
        data: ids.map((manufacturerId) => ({ hospitalId, manufacturerId })),
      });
    }
  });

  await writeAuditLog({
    request,
    hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "HOSPITAL_DRUG_BRANDS_UPDATED",
    entity: "Hospital",
    entityId: hospitalId,
    summary: `${scoped.user.username} updated preferred medicine brands (${ids.length} selected).`,
    metadata: {
      manufacturerIds: ids,
      changes: diffAuditFields(
        { manufacturerIds: previousIds },
        { manufacturerIds: nextIds },
        { fields: ["manufacturerIds"] },
      ),
    },
  });

  return NextResponse.json({ ok: true, count: ids.length });
}
