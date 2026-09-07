import type { FamilyRelation } from "@prisma/client";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import type { HospitalActor } from "@/lib/authz/hospital";
import type { PatientActionResult } from "@/lib/patients/types";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";

export async function linkFamilyMember(params: {
  request: Request;
  user: HospitalActor;
  primaryId: string;
  relatedPatientId: string;
  relation: FamilyRelation;
}): Promise<PatientActionResult> {
  if (!params.relatedPatientId || params.relatedPatientId === params.primaryId) {
    return { ok: false, error: "Select a different family member.", status: 400 };
  }

  const scope = hospitalScope(params.user.hospitalId);
  const [primary, related] = await Promise.all([
    prisma.patient.findFirst({ where: { id: params.primaryId, ...scope, mergedIntoId: null } }),
    prisma.patient.findFirst({ where: { id: params.relatedPatientId, ...scope, mergedIntoId: null } }),
  ]);
  if (!primary || !related) {
    return { ok: false, error: "Patient not found in this hospital.", status: 404 };
  }

  const existingLink = await prisma.patientFamily.findUnique({
    where: {
      primaryPatientId_relatedPatientId: {
        primaryPatientId: params.primaryId,
        relatedPatientId: params.relatedPatientId,
      },
    },
  });

  const link = await prisma.patientFamily.upsert({
    where: {
      primaryPatientId_relatedPatientId: {
        primaryPatientId: params.primaryId,
        relatedPatientId: params.relatedPatientId,
      },
    },
    update: { relation: params.relation },
    create: {
      hospitalId: params.user.hospitalId,
      primaryPatientId: params.primaryId,
      relatedPatientId: params.relatedPatientId,
      relation: params.relation,
    },
  });

  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: "PATIENT_FAMILY_LINKED",
    entity: "Patient",
    entityId: params.primaryId,
    summary: `${params.user.username} linked ${related.firstName} ${related.lastName} as ${params.relation.toLowerCase()} of ${primary.firstName} ${primary.lastName}.`,
    metadata: {
      changes: diffAuditFields(
        existingLink
          ? { relatedPatientId: existingLink.relatedPatientId, relation: existingLink.relation }
          : null,
        { relatedPatientId: params.relatedPatientId, relation: params.relation },
        { fields: ["relatedPatientId", "relation"] },
      ),
    },
  });

  return { ok: true, body: { ok: true, link } };
}
