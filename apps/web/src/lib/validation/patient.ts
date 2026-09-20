import { z } from "zod";
import { dateOfBirthFromAge, parsePatientAge } from "@/lib/display";
import { babyOfName, startOfLocalDay } from "@/lib/patients/infant";
import { mobileValidationError, normalizeMobile } from "@/lib/phone";

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

function resolvePatientDateOfBirth(dateOfBirthRaw: unknown, ageRaw: unknown) {
  const dateOfBirth = dateOfBirthRaw ? new Date(String(dateOfBirthRaw)) : null;
  if (dateOfBirth && !Number.isNaN(dateOfBirth.getTime())) {
    return dateOfBirth;
  }
  const age = parsePatientAge(ageRaw);
  return age === null ? null : dateOfBirthFromAge(age);
}

export const createPatientSchema = z
  .object({
    firstName: z.unknown().optional(),
    lastName: z.unknown().optional(),
    dateOfBirth: z.unknown().optional(),
    age: z.unknown().optional(),
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
    unnamedInfant: z.unknown().optional(),
    parentName: z.unknown().optional(),
    force: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const unnamedInfant = Boolean(data.unnamedInfant);
    const parentName = text(data.parentName);
    const familyOfPatientId = optionalText(data.familyOfPatientId);
    let firstName = text(data.firstName);
    let lastName = text(data.lastName);
    let dateOfBirth = resolvePatientDateOfBirth(data.dateOfBirth, data.age);
    const gender = text(data.gender);
    if (unnamedInfant) {
      if (parentName) firstName = babyOfName(parentName);
      else if (familyOfPatientId) firstName = firstName || "Baby of parent";
      else firstName = babyOfName(firstName.replace(/^baby of\s+/i, ""));
      lastName = "";
      if (!dateOfBirth) {
        dateOfBirth = startOfLocalDay();
      }
      if (!firstName) {
        ctx.addIssue({
          code: "custom",
          message: "Enter the parent name for an unnamed infant.",
        });
        return z.NEVER;
      }
    } else if (!firstName || !dateOfBirth) {
      ctx.addIssue({
        code: "custom",
        message: "First name and age are required.",
      });
      return z.NEVER;
    }
    const phone = normalizeMobile(String(data.phone ?? ""));
    const phoneError = mobileValidationError(phone, "Mobile number");
    if (phoneError) {
      ctx.addIssue({ code: "custom", message: phoneError });
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
      phone,
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
      unnamedInfant,
      parentName: parentName || null,
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
