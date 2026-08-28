import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireHospitalActor, sanitizeLogoData } from "@/lib/front-desk";

export async function PATCH(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (scoped.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hospital admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  // Branding and document policy post to this route separately, so only touch what was sent.
  const data: Prisma.HospitalUpdateInput = {};
  const brandingSent = ["address", "phone", "opdFee", "logoData", "sealData"].some((key) => key in (body ?? {}));

  if (brandingSent) {
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
    data.address = String(body?.address ?? "").trim() || null;
    data.phone = String(body?.phone ?? "").trim() || null;
    data.opdFee = opdFee;
    data.logoData = logoData;
    data.sealData = sealData;
  }

  const policySent = body != null && "requireSignatureForApproval" in body;
  if (policySent) {
    data.requireSignatureForApproval = Boolean(body?.requireSignatureForApproval);
  }

  if (!brandingSent && !policySent) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const hospital = await prisma.hospital.update({
    where: { id: scoped.user.hospitalId },
    data,
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: policySent && !brandingSent ? "HOSPITAL_SIGNATURE_POLICY_UPDATED" : "HOSPITAL_BRANDING_UPDATED",
    entity: "Hospital",
    entityId: hospital.id,
    summary:
      policySent && !brandingSent
        ? `${scoped.user.username} ${data.requireSignatureForApproval ? "required" : "stopped requiring"} signatures for visit summary approval.`
        : `${scoped.user.username} updated hospital print branding.`,
  });

  return NextResponse.json({ ok: true });
}
