import { pad } from "@/lib/ids";

export function tokenLabel(n: number | null | undefined) {
  if (!n) return "—";
  return `T-${pad(n, 3)}`;
}

export function inr(value: { toString(): string } | number | string) {
  return `₹${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const MAX_PATIENT_AGE_YEARS = 150;

export function ageYears(dob: Date, now = new Date()) {
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function parsePatientAge(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const years = Number(raw);
  if (years > MAX_PATIENT_AGE_YEARS) return null;
  return years;
}

export function dateOfBirthFromAge(years: number, now = new Date()) {
  return new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
}

export function ageFromDateInput(value: string, now = new Date()) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const age = ageYears(new Date(year, month - 1, day), now);
  return age >= 0 ? String(age) : null;
}

export function ageLabel(dob: Date) {
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 24) return `${Math.max(0, months)} M`;
  return `${ageYears(dob)} yrs`;
}

export function prettyEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function patientName(patient: { firstName?: string | null; lastName?: string | null }) {
  return `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim();
}

function normalizePersonName(value: string) {
  return value.replace(/\s+Doctor$/i, "").replace(/\s+/g, " ").trim();
}

function lettersOnly(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True when a stored staff label was seeded from the login handle / email local-part. */
export function isLoginHandleDisplayName(
  display: string,
  username?: string | null,
) {
  const cleaned = normalizePersonName(display);
  if (!cleaned) return true;
  if (cleaned.includes("@")) return true;
  if (!username?.trim()) return false;
  const handle = username.includes("@") ? username.split("@")[0]! : username.trim();
  const displayKey = lettersOnly(cleaned);
  const handleKey = lettersOnly(handle);
  if (!displayKey || !handleKey) return false;
  // Exact match only — do not strip role suffixes like "doc", or "Priya Sharma"
  // would look like login handle "priyasharmadoc".
  return displayKey === handleKey;
}

function formatDoctorDisplayName(full: string) {
  const cleaned = normalizePersonName(full);
  if (!cleaned) return "Dr.";
  return /^dr\.?\s/i.test(cleaned) ? cleaned : `Dr. ${cleaned}`;
}

/**
 * Printed doctor name for UI, PDFs, and WhatsApp.
 * Prefer the Doctor Name fields (staff / account first + last), never the raw login or email.
 */
export function doctorName(doctor: {
  firstName?: string | null;
  lastName?: string | null;
  appUser?: {
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}) {
  const fromStaff = normalizePersonName(`${doctor.firstName ?? ""} ${doctor.lastName ?? ""}`);
  const fromAccount = normalizePersonName(
    `${doctor.appUser?.firstName ?? ""} ${doctor.appUser?.lastName ?? ""}`,
  );
  const username = doctor.appUser?.username?.trim() ?? "";

  const proper = [fromAccount, fromStaff].find(
    (name) => name && !isLoginHandleDisplayName(name, username),
  );
  if (proper) return formatDoctorDisplayName(proper);

  const seeded = [fromAccount, fromStaff].find((name) => name && !name.includes("@"));
  if (seeded) return formatDoctorDisplayName(seeded);

  if (username) {
    const handle = username.includes("@") ? username.split("@")[0]! : username;
    const humanized = handle.replace(/[._]/g, " ").replace(/\s*doc$/i, "").trim();
    if (humanized) return formatDoctorDisplayName(humanized);
  }
  return "Dr.";
}

export function physicianLine(doctor: {
  firstName?: string | null;
  lastName?: string | null;
  medicalDegree?: string | null;
  postgraduate?: string | null;
  specialization?: string | null;
  appUser?: {
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}) {
  const name = doctorName(doctor);
  const quals = [doctor.medicalDegree, doctor.postgraduate, doctor.specialization].filter(Boolean);
  return quals.length ? `${name}, ${quals.join(", ")}` : name;
}
