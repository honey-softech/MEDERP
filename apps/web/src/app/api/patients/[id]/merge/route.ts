import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { FRONT_DESK_ROLES, forbidUnless, requireHospitalActor } from "@/lib/front-desk";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, FRONT_DESK_ROLES);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const duplicateId = String(body?.duplicateId ?? "");
  if (!duplicateId || duplicateId === id) {
    return NextResponse.json({ error: "Select a different patient to merge." }, { status: 400 });
  }

  const [survivor, duplicate] = await Promise.all([
    prisma.patient.findFirst({ where: { id, hospitalId: scoped.user.hospitalId, mergedIntoId: null } }),
    prisma.patient.findFirst({
      where: { id: duplicateId, hospitalId: scoped.user.hospitalId, mergedIntoId: null },
    }),
  ]);
  if (!survivor || !duplicate) {
    return NextResponse.json({ error: "Both patients must belong to this hospital and not already be merged." }, { status: 404 });
  }

  const [survivorStay, duplicateStay] = await Promise.all([
    prisma.admission.count({
      where: { patientId: survivor.id, status: { in: ["ADMITTED", "DISCHARGE_ADVISED"] } },
    }),
    prisma.admission.count({
      where: { patientId: duplicate.id, status: { in: ["ADMITTED", "DISCHARGE_ADVISED"] } },
    }),
  ]);
  if (survivorStay > 0 && duplicateStay > 0) {
    return NextResponse.json(
      { error: "Both records have an active admission. Discharge one stay before merging." },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.appointment.updateMany({ where: { patientId: duplicate.id }, data: { patientId: survivor.id } }),
    prisma.invoice.updateMany({ where: { patientId: duplicate.id }, data: { patientId: survivor.id } }),
    prisma.payment.updateMany({ where: { patientId: duplicate.id }, data: { patientId: survivor.id } }),
    prisma.medicalRecord.updateMany({ where: { patientId: duplicate.id }, data: { patientId: survivor.id } }),
    prisma.prescription.updateMany({ where: { patientId: duplicate.id }, data: { patientId: survivor.id } }),
    prisma.visitAssessment.updateMany({ where: { patientId: duplicate.id }, data: { patientId: survivor.id } }),
    prisma.visitVitals.updateMany({ where: { patientId: duplicate.id }, data: { patientId: survivor.id } }),
    prisma.labOrder.updateMany({ where: { patientId: duplicate.id }, data: { patientId: survivor.id } }),
    prisma.admission.updateMany({ where: { patientId: duplicate.id }, data: { patientId: survivor.id } }),
    prisma.patientFamily.deleteMany({
      where: {
        OR: [{ primaryPatientId: duplicate.id }, { relatedPatientId: duplicate.id }],
      },
    }),
    prisma.patient.update({
      where: { id: survivor.id },
      data: {
        advanceBalance: { increment: duplicate.advanceBalance },
        phone: survivor.phone || duplicate.phone,
        email: survivor.email || duplicate.email,
        address: survivor.address || duplicate.address,
        insuranceProvider: survivor.insuranceProvider || duplicate.insuranceProvider,
        insurancePolicyNo: survivor.insurancePolicyNo || duplicate.insurancePolicyNo,
      },
    }),
    prisma.patient.update({
      where: { id: duplicate.id },
      data: { mergedIntoId: survivor.id },
    }),
  ]);

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "PATIENT_MERGED",
    entity: "Patient",
    entityId: survivor.id,
    summary: `${scoped.user.username} merged ${duplicate.firstName} ${duplicate.lastName} (${duplicate.mrn}) into ${survivor.firstName} ${survivor.lastName} (${survivor.mrn}).`,
    metadata: {
      duplicateId: duplicate.id,
      changes: diffAuditFields(
        {
          mergedIntoId: duplicate.mergedIntoId,
          phone: survivor.phone,
          email: survivor.email,
          address: survivor.address,
          advanceBalance: survivor.advanceBalance,
        },
        {
          mergedIntoId: survivor.id,
          phone: survivor.phone || duplicate.phone,
          email: survivor.email || duplicate.email,
          address: survivor.address || duplicate.address,
          advanceBalance: Number(survivor.advanceBalance) + Number(duplicate.advanceBalance),
        },
        { fields: ["mergedIntoId", "phone", "email", "address", "advanceBalance"] },
      ),
    },
  });

  return NextResponse.json({ ok: true });
}
