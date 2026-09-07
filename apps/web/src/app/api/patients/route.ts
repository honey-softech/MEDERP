import { NextResponse } from "next/server";
import type { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  canRegisterPatient,
  CLINICAL_VIEW_ROLES,
  digitsOnly,
  ensureFamilyGroup,
  findDuplicatePatients,
  forbidUnless,
  nextMrn,
  requireHospitalActor,
  sanitizePhotoData,
} from "@/lib/front-desk";
import { createPatientSchema } from "@/lib/validation/patient";
import { parseJsonBody } from "@/lib/validation/parse";

const PATIENT_VIEW_ROLES: AppRole[] = [...CLINICAL_VIEW_ROLES, "ACCOUNTANT"];

export async function GET(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, PATIENT_VIEW_ROLES);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const phone = digitsOnly(searchParams.get("phone") ?? "");
    const summary = {
      id: true,
      mrn: true,
      firstName: true,
      lastName: true,
      phone: true,
      familyGroupId: true,
      familyGroupCode: true,
    } as const;

    if (phone.length >= 8) {
      const matches = await prisma.patient.findMany({
        where: {
          hospitalId: scoped.user.hospitalId,
          mergedIntoId: null,
          phone: { contains: phone.slice(-10) },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: summary,
      });
      const groupIds = [...new Set(matches.map((row) => row.familyGroupId).filter(Boolean))] as string[];
      const family =
        groupIds.length > 0
          ? await prisma.patient.findMany({
              where: {
                hospitalId: scoped.user.hospitalId,
                mergedIntoId: null,
                familyGroupId: { in: groupIds },
              },
              orderBy: { createdAt: "asc" },
              select: summary,
            })
          : matches;
      return NextResponse.json({ patients: family.length ? family : matches, familyMatches: matches });
    }

    const patients = await prisma.patient.findMany({
      where: {
        hospitalId: scoped.user.hospitalId,
        mergedIntoId: null,
        ...(q
          ? {
              OR: [
                { mrn: { contains: q, mode: "insensitive" } },
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { familyGroupCode: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: summary,
    });

    return NextResponse.json({ patients });
  } catch (error) {
    console.error("Failed to list patients", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load patients.", patients: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (!canRegisterPatient(scoped.user)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }

  try {

  const parsed = await parseJsonBody(request, createPatientSchema);
  if (!parsed.ok) return parsed.response;
  const {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    phone,
    email,
    address,
    bloodGroup,
    allergies,
    medicalHistory,
    familyHistory,
    socialHistory,
    currentMedications,
    emergencyName,
    emergencyPhone,
    idProofType,
    idProofNumber,
    insuranceProvider,
    insurancePolicyNo,
    insuranceValidUntil,
    familyOfPatientId,
    familyRelation,
    force,
  } = parsed.data;
  const photoData = sanitizePhotoData(parsed.data.photoData);

  let guardian = familyOfPatientId
    ? await prisma.patient.findFirst({
        where: { id: familyOfPatientId, hospitalId: scoped.user.hospitalId, mergedIntoId: null },
      })
    : null;
  if (familyOfPatientId && !guardian) {
    return NextResponse.json({ error: "Family head not found." }, { status: 404 });
  }

  const duplicates = await findDuplicatePatients(scoped.user.hospitalId, {
    firstName,
    lastName,
    dateOfBirth,
    phone: familyOfPatientId ? null : phone,
    idProofNumber,
  });

  if (duplicates.length > 0 && !force) {
    return NextResponse.json(
      {
        error: "Possible duplicate patient found. Review the match, add as a family member, or register anyway.",
        duplicates,
      },
      { status: 409 },
    );
  }

  const hospital = scoped.user.hospital ?? (await prisma.hospital.findUnique({ where: { id: scoped.user.hospitalId } }));
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 400 });
  }

  let familyGroupId: string | null = null;
  let familyGroupCode: string | null = null;
  if (guardian) {
    const group = await ensureFamilyGroup(guardian, hospital.code);
    familyGroupId = group.familyGroupId;
    familyGroupCode = group.familyGroupCode;
    guardian = { ...guardian, familyGroupId, familyGroupCode };
  }

  const mrn = await nextMrn(scoped.user.hospitalId, hospital.code);
  const patient = await prisma.patient.create({
    data: {
      hospitalId: scoped.user.hospitalId,
      mrn,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone: phone || guardian?.phone || null,
      email,
      address: address || guardian?.address || null,
      bloodGroup,
      allergies,
      medicalHistory,
      familyHistory,
      socialHistory,
      currentMedications,
      emergencyName: emergencyName || (guardian ? `${guardian.firstName} ${guardian.lastName}` : null),
      emergencyPhone: emergencyPhone || guardian?.phone || null,
      idProofType,
      idProofNumber,
      insuranceProvider: insuranceProvider || guardian?.insuranceProvider || null,
      insurancePolicyNo: insurancePolicyNo || guardian?.insurancePolicyNo || null,
      insuranceValidUntil,
      photoData,
      familyGroupId,
      familyGroupCode,
    },
  });

  if (guardian) {
    await prisma.patientFamily.upsert({
      where: {
        primaryPatientId_relatedPatientId: {
          primaryPatientId: guardian.id,
          relatedPatientId: patient.id,
        },
      },
      update: { relation: familyRelation },
      create: {
        hospitalId: scoped.user.hospitalId,
        primaryPatientId: guardian.id,
        relatedPatientId: patient.id,
        relation: familyRelation,
      },
    });
  } else if (phone) {
    const group = await ensureFamilyGroup(patient, hospital.code);
    await prisma.patient.update({
      where: { id: patient.id },
      data: group,
    });
  }

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: guardian ? "FAMILY_MEMBER_REGISTERED" : "PATIENT_REGISTERED",
    entity: "Patient",
    entityId: patient.id,
    summary: guardian
      ? `${scoped.user.username} added ${firstName} ${lastName} (${mrn}) as ${familyRelation.toLowerCase()} under ${guardian.firstName} ${guardian.lastName}.`
      : `${scoped.user.username} registered patient ${firstName} ${lastName} (${mrn}).`,
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
    console.error("Failed to register patient", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not register patient." },
      { status: 500 },
    );
  }
}
