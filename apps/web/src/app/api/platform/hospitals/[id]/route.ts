import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";

type Ctx = { params: Promise<{ id: string }> };

async function requireSoftwareAdmin() {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") {
    return { error: NextResponse.json({ error: "Software admin access required." }, { status: 403 }) };
  }
  return { actor };
}

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireSoftwareAdmin();
  if (scoped.error) return scoped.error;
  const actor = scoped.actor;

  const { id } = await context.params;
  const existing = await prisma.hospital.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: {
    name?: string;
    address?: string | null;
    phone?: string | null;
    opdFee?: number;
    isActive?: boolean;
  } = {};

  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Hospital name is required." }, { status: 400 });
    }
    data.name = name;
  }
  if (body.address !== undefined) {
    data.address = String(body.address ?? "").trim() || null;
  }
  if (body.phone !== undefined) {
    const phoneRaw = String(body.phone ?? "").trim();
    if (phoneRaw) {
      const phone = normalizeMobile(phoneRaw);
      if (!isValidIndianMobile(phone)) {
        return NextResponse.json({ error: "Enter a valid 10-digit hospital mobile." }, { status: 400 });
      }
      const clash = await prisma.hospital.findFirst({
        where: { phone, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json({ error: "That hospital mobile is already used." }, { status: 409 });
      }
      data.phone = phone;
    } else {
      data.phone = null;
    }
  }
  if (body.opdFee !== undefined) {
    const opdFee = Number(body.opdFee);
    if (!Number.isFinite(opdFee) || opdFee < 0) {
      return NextResponse.json({ error: "Enter a valid default OPD amount." }, { status: 400 });
    }
    data.opdFee = opdFee;
  }
  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  const hospital = await prisma.hospital.update({ where: { id }, data });

  // When hospital is deactivated, also deactivate all hospital users so they cannot sign in.
  if (data.isActive === false) {
    await prisma.appUser.updateMany({
      where: {
        hospitalId: id,
        role: { notIn: ["SOFTWARE_ADMIN", "HELPDESK"] },
      },
      data: { isActive: false },
    });
  }

  await writeAuditLog({
    request,
    hospitalId: hospital.id,
    actorUserId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: data.isActive === false ? "HOSPITAL_ACCESS_STOPPED" : data.isActive === true ? "HOSPITAL_ACCESS_ENABLED" : "HOSPITAL_UPDATED",
    entity: "Hospital",
    entityId: hospital.id,
    summary:
      data.isActive === false
        ? `${actor.username} stopped access for hospital ${hospital.code}.`
        : data.isActive === true
          ? `${actor.username} enabled access for hospital ${hospital.code}.`
          : `${actor.username} updated hospital ${hospital.code} details.`,
    metadata: {
      ...data,
      changes: diffAuditFields(
        existing as unknown as Record<string, unknown>,
        hospital as unknown as Record<string, unknown>,
        { fields: Object.keys(data) },
      ),
    },
  });

  return NextResponse.json({ ok: true, hospital });
}
