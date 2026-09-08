import type { MedicalCertificateType } from "@prisma/client";
import { ageLabel, prettyEnum } from "@/lib/display";

export const CERTIFICATE_TYPES = ["SICK_LEAVE", "FITNESS", "GENERAL"] as const;
export const FITNESS_PURPOSES = ["WORK", "SCHOOL", "SPORTS", "TRAVEL"] as const;

export type CertificateType = (typeof CERTIFICATE_TYPES)[number];
export type FitnessPurpose = (typeof FITNESS_PURPOSES)[number];

export type CertificateFields = {
  type: CertificateType;
  diagnosis: string;
  remarks: string | null;
  restFrom: Date | null;
  restTo: Date | null;
  fitFor: FitnessPurpose | null;
  purpose: string | null;
};

export function parseCertificateType(value: unknown): CertificateType | null {
  const type = String(value ?? "").trim().toUpperCase();
  if (!(CERTIFICATE_TYPES as readonly string[]).includes(type)) return null;
  return type as CertificateType;
}

export function parseFitnessPurpose(value: unknown): FitnessPurpose | null {
  const purpose = String(value ?? "").trim().toUpperCase();
  if (!(FITNESS_PURPOSES as readonly string[]).includes(purpose)) return null;
  return purpose as FitnessPurpose;
}

export function parseDay(value: unknown): Date | null | "invalid" {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date;
}

function text(value: unknown) {
  const raw = String(value ?? "").trim();
  return raw || null;
}

export function parseCertificateInput(body: Record<string, unknown> | null):
  | { ok: true; data: CertificateFields }
  | { ok: false; error: string } {
  const type = parseCertificateType(body?.type);
  if (!type) return { ok: false, error: "Choose a certificate type." };

  const diagnosis = text(body?.diagnosis);
  if (!diagnosis) return { ok: false, error: "Add a diagnosis." };

  const restFrom = parseDay(body?.restFrom);
  const restTo = parseDay(body?.restTo);
  if (restFrom === "invalid") return { ok: false, error: "Rest start date is not valid." };
  if (restTo === "invalid") return { ok: false, error: "Rest end date is not valid." };

  const fitFor = body?.fitFor != null && String(body.fitFor).trim() ? parseFitnessPurpose(body.fitFor) : null;
  if (body?.fitFor != null && String(body.fitFor).trim() && !fitFor) {
    return { ok: false, error: "Choose what the patient is fit for." };
  }

  const data: CertificateFields = {
    type,
    diagnosis,
    remarks: text(body?.remarks),
    restFrom,
    restTo,
    fitFor,
    purpose: text(body?.purpose),
  };

  const error = validateCertificateFields(data);
  if (error) return { ok: false, error };
  return { ok: true, data };
}

export function validateCertificateFields(fields: CertificateFields): string | null {
  if (!fields.diagnosis.trim()) return "Add a diagnosis.";

  if (fields.type === "SICK_LEAVE") {
    if (!fields.restFrom || !fields.restTo) return "Choose rest from and to dates.";
    if (fields.restTo.getTime() < fields.restFrom.getTime()) {
      return "Rest end date must be on or after the start date.";
    }
  }

  if (fields.type === "FITNESS" && !fields.fitFor) {
    return "Choose what the patient is fit for.";
  }

  if (fields.type === "GENERAL" && !fields.purpose) {
    return "Describe the purpose of this certificate.";
  }

  return null;
}

export function certificateTitle(type: MedicalCertificateType | CertificateType) {
  if (type === "SICK_LEAVE") return "Medical certificate — Sick leave / rest";
  if (type === "FITNESS") return "Medical fitness certificate";
  return "Medical certificate";
}

export function fitnessPurposeLabel(fitFor?: string | null) {
  if (!fitFor) return "";
  if (fitFor === "WORK") return "work";
  if (fitFor === "SCHOOL") return "school";
  if (fitFor === "SPORTS") return "sports / physical activity";
  if (fitFor === "TRAVEL") return "travel";
  return prettyEnum(fitFor);
}

export function formatCertDate(value: Date) {
  return value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function restPeriodLabel(from?: Date | null, to?: Date | null) {
  if (!from || !to) return "";
  const start = formatCertDate(from);
  const end = formatCertDate(to);
  return start === end ? start : `${start} to ${end}`;
}

export function certificateLetter(input: {
  type: MedicalCertificateType | CertificateType;
  patientName: string;
  mrn: string;
  dateOfBirth: Date;
  gender: string;
  diagnosis: string;
  remarks?: string | null;
  restFrom?: Date | null;
  restTo?: Date | null;
  fitFor?: string | null;
  purpose?: string | null;
  issuedAt: Date;
}) {
  const age = ageLabel(input.dateOfBirth);
  const gender = prettyEnum(input.gender);
  const identity = `${input.patientName} (UHID ${input.mrn}), aged ${age}, ${gender}`;
  let body = "";

  if (input.type === "SICK_LEAVE") {
    const period = restPeriodLabel(input.restFrom, input.restTo) || formatCertDate(input.issuedAt);
    body = `This is to certify that ${identity} was examined and is advised rest from ${period} (inclusive) on account of ${input.diagnosis}.`;
  } else if (input.type === "FITNESS") {
    const activity = fitnessPurposeLabel(input.fitFor) || "their usual duties";
    body = `This is to certify that ${identity} has been examined and is medically fit to resume ${activity} as of ${formatCertDate(input.issuedAt)}. Diagnosis: ${input.diagnosis}.`;
  } else {
    const purpose = input.purpose?.trim() || "the purpose stated below";
    body = `This is to certify that ${identity} ${purpose.replace(/^[Tt]his is to certify that\s+/i, "")}. Diagnosis: ${input.diagnosis}.`;
  }

  if (input.remarks?.trim()) {
    return `${body}\n\nRemarks: ${input.remarks.trim()}`;
  }
  return body;
}
