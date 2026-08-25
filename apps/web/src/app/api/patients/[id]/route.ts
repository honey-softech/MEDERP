import { NextResponse } from "next/server";
import type { Gender, IdProofType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { FRONT_DESK_ROLES, forbidUnless, requireHospitalActor, sanitizePhotoData } from "@/lib/front-desk";

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];
const ID_PROOFS: IdProofType[] = ["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE", "VOTER_ID", "OTHER"];

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id } = await context.params;
  const patient = await prisma.patient.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: {
      familyAsPrimary: { include: { relatedPatient: true } },
      familyAsRelated: { include: { primaryPatient: true } },
      mergedFrom: { select: { id: true, mrn: true, firstName: true, lastName: true } },
    },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }
  return NextResponse.json({ patient });
}

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, FRONT_DESK_ROLES);
  if (denied) return denied;

  try {

  const { id } = await context.params;
  const existing = await prisma.patient.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId, mergedIntoId: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};
  const textFields = [
    "firstName",
    "lastName",
    "phone",
    "email",
    "address",
    "bloodGroup",
    "emergencyName",
    "emergencyPhone",
    "idProofNumber",
    "insuranceProvider",
    "insurancePolicyNo",
  ] as const;

  for (const field of textFields) {
    if (body?.[field] !== undefined) {
      const value = String(body[field] ?? "").trim();
      data[field] = value || null;
    }
  }
  if (body?.dateOfBirth) {
    const dateOfBirth = new Date(String(body.dateOfBirth));
    if (Number.isNaN(dateOfBirth.getTime())) {
      return NextResponse.json({ error: "Invalid date of birth." }, { status: 400 });
    }
    data.dateOfBirth = dateOfBirth;
  }
  if (body?.gender) {
    const gender = String(body.gender) as Gender;
    if (!GENDERS.includes(gender)) {
      return NextResponse.json({ error: "Select a valid gender." }, { status: 400 });
    }
    data.gender = gender;
  }
  if (body?.idProofType !== undefined) {
    const idProofType = body.idProofType ? (String(body.idProofType) as IdProofType) : null;
    if (idProofType && !ID_PROOFS.includes(idProofType)) {
      return NextResponse.json({ error: "Select a valid ID proof type." }, { status: 400 });
    }
    data.idProofType = idProofType;
  }
  if (body?.insuranceValidUntil !== undefined) {
    data.insuranceValidUntil = body.insuranceValidUntil
      ? new Date(String(body.insuranceValidUntil))
      : null;
  }
  if (body?.photoData !== undefined) {
    const photo = sanitizePhotoData(body.photoData);
    data.photoData = photo;
  }
  if (!data.firstName) data.firstName = existing.firstName;
  if (!data.lastName) data.lastName = existing.lastName;

  const patient = await prisma.patient.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "PATIENT_UPDATED",
    entity: "Patient",
    entityId: patient.id,
    summary: `${scoped.user.username} updated patient ${patient.firstName} ${patient.lastName} (${patient.mrn}).`,
  });

  return NextResponse.json({
    ok: true,
    patient: {
      id: patient.id,
      mrn: patient.mrn,
      firstName: patient.firstName,
      lastName: patient.lastName,
    },
  });
  } catch (error) {
    console.error("Failed to update patient", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save patient." },
      { status: 500 },
    );
  }
}
