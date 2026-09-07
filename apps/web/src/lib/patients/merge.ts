import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import type { HospitalActor } from "@/lib/authz/hospital";
import type { PatientActionResult } from "@/lib/patients/types";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";

export function mergeBlockedByAdmissions(survivorStay: number, duplicateStay: number) {
  return survivorStay > 0 && duplicateStay > 0;
}

export async function mergePatients(params: {
  request: Request;
  user: HospitalActor;
  survivorId: string;
  duplicateId: string;
}): Promise<PatientActionResult> {
  if (!params.duplicateId || params.duplicateId === params.survivorId) {
    return { ok: false, error: "Select a different patient to merge.", status: 400 };
  }

  const scope = hospitalScope(params.user.hospitalId);
  const [survivor, duplicate] = await Promise.all([
    prisma.patient.findFirst({ where: { id: params.survivorId, ...scope, mergedIntoId: null } }),
    prisma.patient.findFirst({ where: { id: params.duplicateId, ...scope, mergedIntoId: null } }),
  ]);
  if (!survivor || !duplicate) {
    return {
      ok: false,
      error: "Both patients must belong to this hospital and not already be merged.",
      status: 404,
    };
  }

  const [survivorStay, duplicateStay] = await Promise.all([
    prisma.admission.count({
      where: { patientId: survivor.id, status: { in: ["ADMITTED", "DISCHARGE_ADVISED"] } },
    }),
    prisma.admission.count({
      where: { patientId: duplicate.id, status: { in: ["ADMITTED", "DISCHARGE_ADVISED"] } },
    }),
  ]);
  if (mergeBlockedByAdmissions(survivorStay, duplicateStay)) {
    return {
      ok: false,
      error: "Both records have an active admission. Discharge one stay before merging.",
      status: 409,
    };
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
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: "PATIENT_MERGED",
    entity: "Patient",
    entityId: survivor.id,
    summary: `${params.user.username} merged ${duplicate.firstName} ${duplicate.lastName} (${duplicate.mrn}) into ${survivor.firstName} ${survivor.lastName} (${survivor.mrn}).`,
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

  return { ok: true, body: { ok: true } };
}
