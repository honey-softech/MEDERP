import { prisma } from "@/lib/prisma";
import { doctorName } from "@/lib/front-desk";

export type SignatureSnapshot = {
  id: string;
  imageData: string;
  displayName: string;
  credentials: string | null;
};

/**
 * The signature a document should be stamped with right now. Documents store the
 * returned id, never the image, because signature rows are write-once — that is what
 * lets an old document reprint exactly what was originally signed.
 */
export async function activeSignatureFor(userId: string, hospitalId: string) {
  return prisma.userSignature.findFirst({
    where: { userId, hospitalId, status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: { id: true, displayName: true, credentials: true },
  });
}

/** Name and qualifications printed under the signature image. */
export function signatureNameFor(user: {
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  username: string;
  staffProfile?: {
    firstName?: string | null;
    lastName?: string | null;
    medicalDegree?: string | null;
    postgraduate?: string | null;
    specialization?: string | null;
  } | null;
}) {
  const firstName = user.staffProfile?.firstName ?? user.firstName ?? "";
  const lastName = user.staffProfile?.lastName ?? user.lastName ?? "";
  const full = `${firstName} ${lastName}`.trim();
  if (user.role === "DOCTOR") {
    return doctorName({ firstName, lastName, appUser: { username: user.username } });
  }
  return full || user.username;
}

export function signatureCredentialsFor(user: {
  role: string;
  staffProfile?: {
    medicalDegree?: string | null;
    postgraduate?: string | null;
    specialization?: string | null;
    medicalRegNo?: string | null;
    nursingRegNo?: string | null;
    nursingQualification?: string | null;
    pharmacyRegNo?: string | null;
    pharmacyQualification?: string | null;
    labQualification?: string | null;
    labLicenseNo?: string | null;
    designation?: string | null;
  } | null;
}) {
  const staff = user.staffProfile;
  if (!staff) return null;
  const parts: string[] = [];
  if (user.role === "DOCTOR") {
    parts.push(staff.medicalDegree ?? "", staff.postgraduate ?? "", staff.specialization ?? "");
    if (staff.medicalRegNo) parts.push(`Reg. ${staff.medicalRegNo}`);
  } else if (user.role === "NURSE") {
    parts.push(staff.nursingQualification ?? "");
    if (staff.nursingRegNo) parts.push(`Reg. ${staff.nursingRegNo}`);
  } else if (user.role === "PHARMACIST") {
    parts.push(staff.pharmacyQualification ?? "");
    if (staff.pharmacyRegNo) parts.push(`Reg. ${staff.pharmacyRegNo}`);
  } else if (user.role === "LAB_TECH") {
    parts.push(staff.labQualification ?? "");
    if (staff.labLicenseNo) parts.push(`Lic. ${staff.labLicenseNo}`);
  } else {
    parts.push(staff.designation ?? "");
  }
  const line = parts.map((part) => part.trim()).filter(Boolean).join(", ");
  return line || null;
}

/** Active staff who cannot sign yet — shown before a hospital turns on the approval gate. */
export async function countStaffWithoutSignature(hospitalId: string) {
  const signable = await prisma.appUser.findMany({
    where: {
      hospitalId,
      isActive: true,
      role: { in: ["SUPER_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECH", "ACCOUNTANT"] },
    },
    select: { id: true, role: true },
  });
  const withSignature = await prisma.userSignature.findMany({
    where: { hospitalId, status: "ACTIVE" },
    select: { userId: true },
    distinct: ["userId"],
  });
  const covered = new Set(withSignature.map((row) => row.userId));
  const doctors = signable.filter((row) => row.role === "DOCTOR");
  return {
    total: signable.length,
    missing: signable.filter((row) => !covered.has(row.id)).length,
    doctorsMissing: doctors.filter((row) => !covered.has(row.id)).length,
  };
}
