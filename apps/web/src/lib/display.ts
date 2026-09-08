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

export function ageYears(dob: Date) {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
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

export function patientName(patient: { firstName: string; lastName: string }) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

export function doctorName(doctor: {
  firstName: string;
  lastName: string;
  appUser?: { username: string } | null;
}) {
  const full = `${doctor.firstName} ${doctor.lastName}`.replace(/\s+Doctor$/i, "").trim();
  if (full) {
    return /^dr\.?\s/i.test(full) ? full : `Dr. ${full}`;
  }
  const username = doctor.appUser?.username?.trim();
  if (username) {
    return /^dr/i.test(username) ? username : `Dr. ${username}`;
  }
  return /^dr/i.test(full) ? full : `Dr. ${full}`;
}

export function physicianLine(doctor: {
  firstName: string;
  lastName: string;
  medicalDegree?: string | null;
  postgraduate?: string | null;
  specialization?: string | null;
  appUser?: { username: string } | null;
}) {
  const name = doctorName(doctor);
  const quals = [doctor.medicalDegree, doctor.postgraduate, doctor.specialization].filter(Boolean);
  return quals.length ? `${name}, ${quals.join(", ")}` : name;
}
