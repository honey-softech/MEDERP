import type { Prisma } from "@prisma/client";
import { nextFamilyGroupCode } from "@/lib/ids";
import { prisma } from "@/lib/prisma";

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function sanitizePhotoData(value: unknown) {
  const photo = String(value ?? "").trim();
  if (!photo) return null;
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(photo)) return null;
  if (photo.length > 900_000) return null;
  return photo;
}

export function sanitizeLogoData(value: unknown) {
  const logo = String(value ?? "").trim();
  if (!logo) return null;
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(logo)) return null;
  if (logo.length > 1_500_000) return null;
  return logo;
}

/** PNG is allowed here because a signature cleaned to a transparent background cannot be JPEG. */
export function sanitizeSignatureData(value: unknown) {
  const data = String(value ?? "").trim();
  if (!data) return null;
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(data)) return null;
  if (data.length > 400_000) return null;
  return data;
}

export async function ensureFamilyGroup(
  patient: { id: string; hospitalId: string; familyGroupId: string | null; familyGroupCode: string | null },
  hospitalCode: string,
) {
  if (patient.familyGroupId && patient.familyGroupCode) {
    return { familyGroupId: patient.familyGroupId, familyGroupCode: patient.familyGroupCode };
  }
  const familyGroupId = patient.familyGroupId ?? crypto.randomUUID();
  const familyGroupCode = patient.familyGroupCode ?? (await nextFamilyGroupCode(patient.hospitalId, hospitalCode));
  await prisma.patient.update({
    where: { id: patient.id },
    data: { familyGroupId, familyGroupCode },
  });
  return { familyGroupId, familyGroupCode };
}

export async function findDuplicatePatients(
  hospitalId: string,
  input: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    phone?: string | null;
    idProofNumber?: string | null;
    excludeId?: string;
  },
) {
  const or: Prisma.PatientWhereInput[] = [
    {
      firstName: { equals: input.firstName, mode: "insensitive" },
      lastName: { equals: input.lastName, mode: "insensitive" },
      dateOfBirth: input.dateOfBirth,
    },
  ];
  if (input.phone) or.push({ phone: input.phone });
  if (input.idProofNumber) or.push({ idProofNumber: input.idProofNumber });

  return prisma.patient.findMany({
    where: {
      hospitalId,
      mergedIntoId: null,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: or,
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}
