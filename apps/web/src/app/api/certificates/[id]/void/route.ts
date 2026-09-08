import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { DOCTOR_VISIT_ROLES, forbidUnless, patientName, requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, DOCTOR_VISIT_ROLES);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const voidReason = String(body?.reason ?? "").trim() || null;

  const certificate = await prisma.medicalCertificate.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: { patient: { select: { firstName: true, lastName: true } } },
  });
  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }
  if (certificate.status === "VOIDED") {
    return NextResponse.json({ error: "This certificate is already voided." }, { status: 409 });
  }
  if (scoped.user.role !== "SUPER_ADMIN" && certificate.issuedByUserId !== scoped.user.id) {
    return NextResponse.json({ error: "You can only void certificates you issued." }, { status: 403 });
  }

  const updated = await prisma.medicalCertificate.update({
    where: { id: certificate.id },
    data: {
      status: "VOIDED",
      voidedAt: new Date(),
      voidedByUserId: scoped.user.id,
      voidReason,
    },
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "MEDICAL_CERTIFICATE_VOIDED",
    entity: "MedicalCertificate",
    entityId: certificate.id,
    summary: `${scoped.user.username} voided ${certificate.certificateNo} for ${patientName(certificate.patient)}.`,
    metadata: { reason: voidReason },
  });

  return NextResponse.json({ ok: true, certificate: updated });
}
