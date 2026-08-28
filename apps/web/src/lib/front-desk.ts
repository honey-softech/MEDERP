import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { AppRole, Prisma } from "@prisma/client";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { staffIsOnApprovedLeave } from "@/lib/staff-leave";

export const FRONT_DESK_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST"];
export const WALK_IN_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR"];
export const PATIENT_REGISTER_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR"];
export const CLINICAL_VIEW_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE"];
export const NURSE_VITALS_ROLES: AppRole[] = ["SUPER_ADMIN", "NURSE"];
export const DOCTOR_VISIT_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR"];
export const PRINT_SUMMARY_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"];
export const BILLING_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "ACCOUNTANT"];
export const WAIVER_APPROVER_ROLES: AppRole[] = ["SUPER_ADMIN", "ACCOUNTANT"];
export const LAB_WORK_ROLES: AppRole[] = ["SUPER_ADMIN", "LAB_TECH"];
export const LAB_VIEW_ROLES: AppRole[] = ["SUPER_ADMIN", "LAB_TECH", "DOCTOR", "NURSE", "RECEPTIONIST"];
export const LAB_REPORT_VIEW_ROLES: AppRole[] = ["DOCTOR", "NURSE"];
export const EXTERNAL_REPORT_UPLOAD_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"];
export { PHARMACY_ROLES } from "@/lib/pharmacy";

export type HospitalActor = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> & {
  hospitalId: string;
};

export type HospitalActorResult =
  | { error: NextResponse; user?: undefined }
  | { user: HospitalActor; error?: undefined };

export async function requireHospitalActor(): Promise<HospitalActorResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  if (!user.hospitalId || isPlatformRole(user.role)) {
    return { error: NextResponse.json({ error: "Hospital access required." }, { status: 403 }) };
  }
  return { user: user as HospitalActor };
}

export async function requireHospitalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isPlatformRole(user.role)) redirect("/");
  if (!user.hospitalId) redirect("/join");
  return user as HospitalActor;
}

export function forbidUnless(role: AppRole, roles: AppRole[]) {
  if (!roles.includes(role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }
  return null;
}

export async function nextCounter(hospitalId: string, kind: string) {
  const row = await prisma.hospitalCounter.upsert({
    where: { hospitalId_kind: { hospitalId, kind } },
    create: { hospitalId, kind, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export function pad(value: number, size = 5) {
  return String(value).padStart(size, "0");
}

export async function nextMrn(hospitalId: string, hospitalCode: string) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 80; attempt++) {
    const n = await nextCounter(hospitalId, `PATIENT-${year}`);
    const mrn = `${hospitalCode}-${year}-${pad(n)}`;
    const taken = await prisma.patient.findUnique({
      where: { hospitalId_mrn: { hospitalId, mrn } },
      select: { id: true },
    });
    if (!taken) return mrn;
  }
  return `${hospitalCode}-${year}-${pad(Date.now() % 100000)}`;
}

export async function nextFamilyGroupCode(hospitalId: string, hospitalCode: string) {
  const n = await nextCounter(hospitalId, "FAMILY");
  return `FAM-${hospitalCode}-${pad(n)}`;
}

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

export async function nextInvoiceNo(hospitalId: string, hospitalCode: string) {
  const n = await nextCounter(hospitalId, "INVOICE");
  return `INV-${hospitalCode}-${pad(n)}`;
}

export async function nextToken(hospitalId: string, doctorId: string, at = new Date()) {
  const day = at.toISOString().slice(0, 10);
  return nextCounter(hospitalId, `TOKEN-${day}-${doctorId}`);
}

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

export function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

/** Parse YYYY-MM-DD as a local calendar day (avoids UTC shift). */
export function parseLocalDay(value?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) {
    const fallback = value ? new Date(value) : new Date();
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function isSameCalendarDay(value: Date, reference = new Date()) {
  const { start, end } = dayRange(reference);
  return value >= start && value < end;
}

export function canNurseRecordVitals(appointment: { scheduledAt: Date; status: string }) {
  if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) return false;
  return isSameCalendarDay(appointment.scheduledAt);
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
  if (full && doctor.lastName) {
    return /^dr/i.test(full) ? full : `Dr. ${full}`;
  }
  const username = doctor.appUser?.username?.trim();
  if (username) {
    return /^dr/i.test(username) ? username : `Dr. ${username}`;
  }
  return /^dr/i.test(full) ? full : `Dr. ${full}`;
}

export async function ensureDoctorStaff(params: {
  hospitalId: string;
  appUserId: string;
  username: string;
  mobile: string;
}) {
  const existing = await prisma.staff.findUnique({ where: { appUserId: params.appUserId } });
  if (existing) return existing;

  const parts = params.username.replace(/[._]/g, " ").split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? params.username;
  const lastName = parts.slice(1).join(" ");
  const email = `${params.username.toLowerCase()}@hospital.local`;

  return prisma.staff.create({
    data: {
      hospitalId: params.hospitalId,
      appUserId: params.appUserId,
      email: `${params.hospitalId.slice(-6)}.${email}`,
      firstName,
      lastName,
      role: "DOCTOR",
      phone: params.mobile,
    },
  });
}

export async function listBookableDoctors(hospitalId: string) {
  const users = await prisma.appUser.findMany({
    where: { hospitalId, role: "DOCTOR" },
    orderBy: { username: "asc" },
  });

  const doctors = [];
  for (const user of users) {
    const staff = await ensureDoctorStaff({
      hospitalId,
      appUserId: user.id,
      username: user.username,
      mobile: user.mobile,
    });
    doctors.push({
      ...staff,
      appUser: { username: user.username },
    });
  }
  return doctors;
}

export async function staffIdForAppUser(appUserId: string, hospitalId: string) {
  const staff = await prisma.staff.findFirst({
    where: { appUserId, hospitalId, role: "DOCTOR" },
  });
  return staff?.id ?? null;
}

export function groupByDoctor<
  T extends {
    doctorId: string;
    doctor: Parameters<typeof doctorName>[0];
    tokenNumber: number | null;
    status: string;
  },
>(rows: T[]) {
  const groups = new Map<string, { doctor: T["doctor"]; items: T[] }>();
  for (const row of rows) {
    const current = groups.get(row.doctorId) ?? { doctor: row.doctor, items: [] as T[] };
    current.items.push(row);
    groups.set(row.doctorId, current);
  }
  return [...groups.entries()]
    .map(([doctorId, group]) => ({
      doctorId,
      ...group,
      waiting: group.items.filter((row) => row.status === "SCHEDULED").length,
      inConsult: group.items.filter((row) => row.status === "CHECKED_IN" || row.status === "IN_PROGRESS").length,
      lastToken: group.items.reduce((max, row) => Math.max(max, row.tokenNumber ?? 0), 0),
    }))
    .sort((a, b) => doctorName(a.doctor).localeCompare(doctorName(b.doctor)));
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

export async function doctorIsOnLeave(hospitalId: string, doctorId: string, at: Date) {
  return staffIsOnApprovedLeave(hospitalId, doctorId, at);
}

export const DEFAULT_DEPARTMENTS = [
  { code: "CARD", name: "Cardiology", description: "Heart and vascular care", consultationFee: 800 },
  { code: "GEN", name: "General Medicine", description: "Outpatient general care", consultationFee: 500 },
  { code: "ORTHO", name: "Orthopedics", description: "Bone and joint care", consultationFee: 700 },
  { code: "ENT", name: "ENT", description: "Ear, nose and throat", consultationFee: 500 },
  { code: "PED", name: "Paediatrics", description: "Child health", consultationFee: 500 },
];

export async function seedHospitalDepartments(hospitalId: string) {
  await Promise.all(
    DEFAULT_DEPARTMENTS.map((dept) =>
      prisma.department.upsert({
        where: { hospitalId_code: { hospitalId, code: dept.code } },
        update: {},
        create: { hospitalId, ...dept },
      }),
    ),
  );
}

export function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function invoiceStatusFromTotals(netTotal: number, paidAmount: number) {
  if (netTotal <= 0 || paidAmount + 0.001 >= netTotal) return "PAID" as const;
  if (paidAmount <= 0) return "ISSUED" as const;
  return "PARTIALLY_PAID" as const;
}

export const DEFAULT_OPD_FEE = 500;

export function consultationFeeForVisit(appointment: {
  visitType: string;
  doctor: { consultationFee?: { toString(): string } | number | null; followUpFee?: { toString(): string } | number | null };
  department?: { consultationFee?: { toString(): string } | number | null } | null;
  hospital?: { opdFee?: { toString(): string } | number | null } | null;
}) {
  const followUp = appointment.visitType === "FOLLOW_UP" ? Number(appointment.doctor.followUpFee ?? 0) : 0;
  if (appointment.visitType === "FOLLOW_UP" && followUp > 0) return followUp;
  const doctorFee = Number(appointment.doctor.consultationFee ?? 0);
  if (doctorFee > 0) return doctorFee;
  const hospitalFee = Number(appointment.hospital?.opdFee ?? 0);
  if (hospitalFee > 0) return hospitalFee;
  const departmentFee = Number(appointment.department?.consultationFee ?? 0);
  if (departmentFee > 0) return departmentFee;
  return DEFAULT_OPD_FEE;
}

export function amountsMatch(left: number, right: number) {
  return Math.abs(left - right) <= 0.01;
}

export function paymentNote(input: {
  method: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  referenceNo?: string | null;
  extra?: string | null;
}) {
  const parts: string[] = [];
  if (input.method === "CARD") {
    if (input.cardBrand) parts.push(input.cardBrand);
    if (input.cardLast4) parts.push(`ending ${input.cardLast4}`);
    if (input.referenceNo) parts.push(`Txn ${input.referenceNo}`);
  }
  if (input.extra) parts.push(input.extra);
  return parts.join(" · ") || null;
}

export function reminderMessage(input: {
  patient: string;
  doctor: string;
  hospital: string;
  when: Date;
  token?: string;
}) {
  const when = input.when.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const token = input.token ? ` Token ${input.token}.` : "";
  return `Hi ${input.patient}, reminder for your appointment with ${input.doctor} at ${input.hospital} on ${when}.${token}`;
}
