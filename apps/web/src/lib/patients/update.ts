import type { Prisma } from "@prisma/client";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { DOCTOR_VISIT_ROLES, FRONT_DESK_ROLES, type HospitalActor } from "@/lib/authz/hospital";
import { sanitizePhotoData } from "@/lib/opd/patients";
import type { PatientActionResult } from "@/lib/patients/types";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";
import { CLINICAL_HISTORY_FIELDS, GENDERS, ID_PROOFS } from "@/lib/validation/patient";

const FRONT_DESK_TEXT_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "address",
  "bloodGroup",
  ...CLINICAL_HISTORY_FIELDS,
  "emergencyName",
  "emergencyPhone",
  "idProofNumber",
  "insuranceProvider",
  "insurancePolicyNo",
] as const;

export function buildPatientUpdatePayload(input: {
  isFrontDesk: boolean;
  body: Record<string, unknown>;
  existing: { firstName: string; lastName: string };
}): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const data: Record<string, unknown> = {};
  const textFields = input.isFrontDesk ? FRONT_DESK_TEXT_FIELDS : CLINICAL_HISTORY_FIELDS;

  for (const field of textFields) {
    if (input.body[field] !== undefined) {
      const value = String(input.body[field] ?? "").trim();
      data[field] = value || null;
    }
  }

  if (input.isFrontDesk) {
    if (input.body.dateOfBirth) {
      const dateOfBirth = new Date(String(input.body.dateOfBirth));
      if (Number.isNaN(dateOfBirth.getTime())) {
        return { ok: false, error: "Invalid date of birth." };
      }
      data.dateOfBirth = dateOfBirth;
    }
    if (input.body.gender) {
      const gender = String(input.body.gender);
      if (!(GENDERS as readonly string[]).includes(gender)) {
        return { ok: false, error: "Select a valid gender." };
      }
      data.gender = gender;
    }
    if (input.body.idProofType !== undefined) {
      const idProofType = input.body.idProofType ? String(input.body.idProofType) : null;
      if (idProofType && !(ID_PROOFS as readonly string[]).includes(idProofType)) {
        return { ok: false, error: "Select a valid ID proof type." };
      }
      data.idProofType = idProofType;
    }
    if (input.body.insuranceValidUntil !== undefined) {
      if (!input.body.insuranceValidUntil) {
        data.insuranceValidUntil = null;
      } else {
        const insuranceValidUntil = new Date(String(input.body.insuranceValidUntil));
        if (Number.isNaN(insuranceValidUntil.getTime())) {
          return { ok: false, error: "Enter a valid insurance expiry date." };
        }
        data.insuranceValidUntil = insuranceValidUntil;
      }
    }
    if (input.body.photoData !== undefined) {
      data.photoData = sanitizePhotoData(input.body.photoData);
    }
    if (!data.firstName) data.firstName = input.existing.firstName;
    if (!data.lastName) data.lastName = input.existing.lastName;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No changes provided." };
  }
  return { ok: true, data };
}

export async function updatePatient(params: {
  request: Request;
  user: HospitalActor;
  patientId: string;
  body: Record<string, unknown>;
}): Promise<PatientActionResult> {
  const isFrontDesk = FRONT_DESK_ROLES.includes(params.user.role);
  const isClinician = DOCTOR_VISIT_ROLES.includes(params.user.role);
  if (!isFrontDesk && !isClinician) {
    return { ok: false, error: "You do not have access to this action.", status: 403 };
  }

  const existing = await prisma.patient.findFirst({
    where: { id: params.patientId, ...hospitalScope(params.user.hospitalId), mergedIntoId: null },
  });
  if (!existing) {
    return { ok: false, error: "Patient not found.", status: 404 };
  }

  const payload = buildPatientUpdatePayload({
    isFrontDesk,
    body: params.body,
    existing,
  });
  if (!payload.ok) {
    return { ok: false, error: payload.error, status: 400 };
  }

  const patient = await prisma.patient.update({
    where: { id: params.patientId },
    data: payload.data as Prisma.PatientUpdateInput,
  });

  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: "PATIENT_UPDATED",
    entity: "Patient",
    entityId: patient.id,
    summary: `${params.user.username} updated patient ${patient.firstName} ${patient.lastName} (${patient.mrn}).`,
    metadata: {
      changes: diffAuditFields(
        existing as unknown as Record<string, unknown>,
        patient as unknown as Record<string, unknown>,
        { fields: Object.keys(payload.data) },
      ),
    },
  });

  return {
    ok: true,
    body: {
      ok: true,
      patient: {
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstName,
        lastName: patient.lastName,
      },
    },
  };
}
