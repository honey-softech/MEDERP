import { z } from "zod";

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const ID_PROOFS = ["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE", "VOTER_ID", "OTHER"] as const;
export const FAMILY_RELATIONS = ["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"] as const;
export const CLINICAL_HISTORY_FIELDS = [
  "allergies",
  "medicalHistory",
  "familyHistory",
  "socialHistory",
  "currentMedications",
] as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  return text(value) || null;
}

export const createPatientSchema = z
  .object({
    firstName: z.unknown().optional(),
    lastName: z.unknown().optional(),
    dateOfBirth: z.unknown().optional(),
    gender: z.unknown().optional(),
    phone: z.unknown().optional(),
    email: z.unknown().optional(),
    address: z.unknown().optional(),
    bloodGroup: z.unknown().optional(),
    allergies: z.unknown().optional(),
    medicalHistory: z.unknown().optional(),
    familyHistory: z.unknown().optional(),
    socialHistory: z.unknown().optional(),
    currentMedications: z.unknown().optional(),
    emergencyName: z.unknown().optional(),
    emergencyPhone: z.unknown().optional(),
    idProofType: z.unknown().optional(),
    idProofNumber: z.unknown().optional(),
    insuranceProvider: z.unknown().optional(),
    insurancePolicyNo: z.unknown().optional(),
    insuranceValidUntil: z.unknown().optional(),
    photoData: z.unknown().optional(),
    familyOfPatientId: z.unknown().optional(),
    familyRelation: z.unknown().optional(),
    force: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const firstName = text(data.firstName);
    const lastName = text(data.lastName);
    const dateOfBirth = data.dateOfBirth ? new Date(String(data.dateOfBirth)) : null;
    const gender = text(data.gender);
    if (!firstName || !lastName || !dateOfBirth || Number.isNaN(dateOfBirth.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "First name, last name, and date of birth are required.",
      });
      return z.NEVER;
    }
    if (!(GENDERS as readonly string[]).includes(gender)) {
      ctx.addIssue({ code: "custom", message: "Select a valid gender." });
      return z.NEVER;
    }
    const idProofTypeRaw = optionalText(data.idProofType);
    if (idProofTypeRaw && !(ID_PROOFS as readonly string[]).includes(idProofTypeRaw)) {
      ctx.addIssue({ code: "custom", message: "Select a valid ID proof type." });
      return z.NEVER;
    }
    const familyOfPatientId = optionalText(data.familyOfPatientId);
    const familyRelation = text(data.familyRelation) || "CHILD";
    if (familyOfPatientId && !(FAMILY_RELATIONS as readonly string[]).includes(familyRelation)) {
      ctx.addIssue({ code: "custom", message: "Select a valid family relation." });
      return z.NEVER;
    }
    const insuranceValidUntil = data.insuranceValidUntil ? new Date(String(data.insuranceValidUntil)) : null;
    if (insuranceValidUntil && Number.isNaN(insuranceValidUntil.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid insurance expiry date." });
      return z.NEVER;
    }
    return {
      firstName,
      lastName,
      dateOfBirth,
      gender: gender as (typeof GENDERS)[number],
      phone: optionalText(data.phone),
      email: optionalText(data.email),
      address: optionalText(data.address),
      bloodGroup: optionalText(data.bloodGroup),
      allergies: optionalText(data.allergies),
      medicalHistory: optionalText(data.medicalHistory),
      familyHistory: optionalText(data.familyHistory),
      socialHistory: optionalText(data.socialHistory),
      currentMedications: optionalText(data.currentMedications),
      emergencyName: optionalText(data.emergencyName),
      emergencyPhone: optionalText(data.emergencyPhone),
      idProofType: (idProofTypeRaw as (typeof ID_PROOFS)[number] | null) ?? null,
      idProofNumber: optionalText(data.idProofNumber),
      insuranceProvider: optionalText(data.insuranceProvider),
      insurancePolicyNo: optionalText(data.insurancePolicyNo),
      insuranceValidUntil,
      photoData: data.photoData,
      familyOfPatientId,
      familyRelation: familyRelation as (typeof FAMILY_RELATIONS)[number],
      force: Boolean(data.force),
    };
  });

export const updatePatientSchema = z.preprocess(
  (raw) => (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
  z.record(z.string(), z.unknown()),
);

export const mergePatientSchema = z
  .object({
    duplicateId: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const duplicateId = text(data.duplicateId);
    if (!duplicateId) {
      ctx.addIssue({ code: "custom", message: "Select a different patient to merge." });
      return z.NEVER;
    }
    return { duplicateId };
  });

export const linkFamilySchema = z
  .object({
    relatedPatientId: z.unknown().optional(),
    relation: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const relatedPatientId = text(data.relatedPatientId);
    const relation = text(data.relation);
    if (!(FAMILY_RELATIONS as readonly string[]).includes(relation)) {
      ctx.addIssue({ code: "custom", message: "Select a valid family relation." });
      return z.NEVER;
    }
    if (!relatedPatientId) {
      ctx.addIssue({ code: "custom", message: "Select a different family member." });
      return z.NEVER;
    }
    return { relatedPatientId, relation: relation as (typeof FAMILY_RELATIONS)[number] };
  });
