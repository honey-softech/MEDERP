import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireHospitalActor, sanitizeLogoData } from "@/lib/front-desk";

export async function PATCH(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (scoped.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hospital admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const address = String(body?.address ?? "").trim() || null;
  const phone = String(body?.phone ?? "").trim() || null;
  const opdFee = Number(body?.opdFee ?? 500);
  if (!Number.isFinite(opdFee) || opdFee < 0) {
    return NextResponse.json({ error: "Enter a valid default OPD amount." }, { status: 400 });
  }
  const logoData = sanitizeLogoData(body?.logoData);
  const sealData = sanitizeLogoData(body?.sealData);
  if (body?.logoData && !logoData) {
    return NextResponse.json({ error: "Hospital logo must be a smaller image file." }, { status: 400 });
  }
  if (body?.sealData && !sealData) {
    return NextResponse.json({ error: "Seal icon must be a smaller image file." }, { status: 400 });
  }

  const hospital = await prisma.hospital.update({
    where: { id: scoped.user.hospitalId },
    data: { address, phone, logoData, sealData, opdFee },
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "HOSPITAL_BRANDING_UPDATED",
    entity: "Hospital",
    entityId: hospital.id,
    summary: `${scoped.user.username} updated hospital print branding.`,
  });

  return NextResponse.json({ ok: true });
}
