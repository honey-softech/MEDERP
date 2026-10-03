import { NextRequest, NextResponse } from "next/server";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import {
  addPreferredManufacturer,
  listManufacturersForPicker,
  listPreferredManufacturers,
  replacePreferredManufacturers,
} from "@/lib/drug-brands";
import { requireHospitalActor, forbidUnless } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, ["SUPER_ADMIN"]);
  if (denied) return denied;

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const [selected, suggestions] = await Promise.all([
    listPreferredManufacturers(scoped.user.hospitalId),
    listManufacturersForPicker(q, 40),
  ]);

  return NextResponse.json({
    selected: selected.map((row) => ({
      id: row.id,
      name: row.name,
      medicineCount: row.medicineCount,
      priority: row.priority,
    })),
    suggestions,
  });
}

/** Quick-add one manufacturer from prescription search (doctor or super admin). */
export async function POST(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, ["SUPER_ADMIN", "DOCTOR"]);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as {
    manufacturerId?: unknown;
    manufacturerName?: unknown;
  } | null;

  const manufacturerId = typeof body?.manufacturerId === "string" ? body.manufacturerId.trim() : "";
  const manufacturerName = typeof body?.manufacturerName === "string" ? body.manufacturerName.trim() : "";
  if (!manufacturerId && !manufacturerName) {
    return NextResponse.json({ error: "manufacturerId or manufacturerName required." }, { status: 400 });
  }

  const result = await addPreferredManufacturer(scoped.user.hospitalId, {
    manufacturerId: manufacturerId || undefined,
    manufacturerName: manufacturerName || undefined,
  });

  if (result.error || !result.manufacturer) {
    return NextResponse.json({ error: result.error ?? "Manufacturer not found." }, { status: 404 });
  }

  if (!result.alreadyPreferred) {
    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "HOSPITAL_DRUG_BRAND_ADDED",
      entity: "Hospital",
      entityId: scoped.user.hospitalId,
      summary: `${scoped.user.username} added preferred medicine brand ${result.manufacturer.name}.`,
      metadata: { manufacturerId: result.manufacturer.id, manufacturerName: result.manufacturer.name },
    });
  }

  return NextResponse.json({
    ok: true,
    alreadyPreferred: result.alreadyPreferred,
    manufacturer: {
      id: result.manufacturer.id,
      name: result.manufacturer.name,
      medicineCount: result.manufacturer.medicineCount,
    },
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

  await replacePreferredManufacturers(hospitalId, ids);

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
