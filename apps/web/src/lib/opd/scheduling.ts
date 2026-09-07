import { doctorName } from "@/lib/display";
import { prisma } from "@/lib/prisma";
import { staffIsOnApprovedLeave } from "@/lib/staff-leave";

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

export function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
