import { NextResponse } from "next/server";
import type { AppRole, FamilyRelation, Gender, IdProofType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  PATIENT_REGISTER_ROLES,
  CLINICAL_VIEW_ROLES,
  digitsOnly,
  ensureFamilyGroup,
  findDuplicatePatients,
  forbidUnless,
  nextMrn,
  requireHospitalActor,
  sanitizePhotoData,
} from "@/lib/front-desk";

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];
const ID_PROOFS: IdProofType[] = ["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE", "VOTER_ID", "OTHER"];
const RELATIONS: FamilyRelation[] = ["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"];
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
  const denied = forbidUnless(scoped.user.role, PATIENT_REGISTER_ROLES);
  if (denied) return denied;

  try {

  const body = await request.json().catch(() => null);
  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const dateOfBirth = body?.dateOfBirth ? new Date(String(body.dateOfBirth)) : null;
  const gender = String(body?.gender ?? "") as Gender;
  const phone = String(body?.phone ?? "").trim() || null;
  const email = String(body?.email ?? "").trim() || null;
  const address = String(body?.address ?? "").trim() || null;
  const bloodGroup = String(body?.bloodGroup ?? "").trim() || null;
  const allergies = String(body?.allergies ?? "").trim() || null;
  const medicalHistory = String(body?.medicalHistory ?? "").trim() || null;
  const familyHistory = String(body?.familyHistory ?? "").trim() || null;
  const socialHistory = String(body?.socialHistory ?? "").trim() || null;
  const currentMedications = String(body?.currentMedications ?? "").trim() || null;
  const emergencyName = String(body?.emergencyName ?? "").trim() || null;
  const emergencyPhone = String(body?.emergencyPhone ?? "").trim() || null;
  const idProofType = body?.idProofType ? (String(body.idProofType) as IdProofType) : null;
  const idProofNumber = String(body?.idProofNumber ?? "").trim() || null;
  const insuranceProvider = String(body?.insuranceProvider ?? "").trim() || null;
  const insurancePolicyNo = String(body?.insurancePolicyNo ?? "").trim() || null;
  const insuranceValidUntil = body?.insuranceValidUntil ? new Date(String(body.insuranceValidUntil)) : null;
  const photoData = sanitizePhotoData(body?.photoData);
  const familyOfPatientId = String(body?.familyOfPatientId ?? "").trim() || null;
  const familyRelation = (String(body?.familyRelation ?? "CHILD") as FamilyRelation) || "CHILD";
  const force = Boolean(body?.force);

  if (!firstName || !lastName || !dateOfBirth || Number.isNaN(dateOfBirth.getTime())) {
    return NextResponse.json({ error: "First name, last name, and date of birth are required." }, { status: 400 });
  }
  if (!GENDERS.includes(gender)) {
    return NextResponse.json({ error: "Select a valid gender." }, { status: 400 });
  }
  if (idProofType && !ID_PROOFS.includes(idProofType)) {
    return NextResponse.json({ error: "Select a valid ID proof type." }, { status: 400 });
  }
  if (familyOfPatientId && !RELATIONS.includes(familyRelation)) {
    return NextResponse.json({ error: "Select a valid family relation." }, { status: 400 });
  }

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
