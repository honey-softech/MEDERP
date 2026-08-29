import type { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pushNotificationToUser } from "@/lib/realtime";
import type { StaffNotice } from "@/lib/realtime-events";

function toNotice(row: {
  id: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: Date;
  appointmentId: string | null;
}): StaffNotice {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    href: row.href,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
    appointmentId: row.appointmentId,
  };
}

export async function notifyHospitalRole(params: {
  hospitalId: string;
  role: AppRole;
  appointmentId?: string | null;
  title: string;
  body: string;
  href?: string | null;
}) {
  const users = await prisma.appUser.findMany({
    where: {
      hospitalId: params.hospitalId,
      role: params.role,
      isVerified: true,
      isActive: true,
    },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  const created = await prisma.$transaction(
    users.map((user) =>
      prisma.staffNotification.create({
        data: {
          hospitalId: params.hospitalId,
          userId: user.id,
          appointmentId: params.appointmentId ?? null,
          title: params.title,
          body: params.body,
          href: params.href ?? null,
        },
      }),
    ),
  );
  for (const row of created) {
    pushNotificationToUser(row.userId, toNotice(row));
  }
  return created.length;
}

export async function notifyHospitalStaffExcept(params: {
  hospitalId: string;
  exceptUserId: string;
  title: string;
  body: string;
  href?: string | null;
}) {
  const users = await prisma.appUser.findMany({
    where: {
      hospitalId: params.hospitalId,
      id: { not: params.exceptUserId },
      isVerified: true,
      isActive: true,
    },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  const created = await prisma.$transaction(
    users.map((user) =>
      prisma.staffNotification.create({
        data: {
          hospitalId: params.hospitalId,
          userId: user.id,
          title: params.title,
          body: params.body,
          href: params.href ?? null,
        },
      }),
    ),
  );
  for (const row of created) {
    pushNotificationToUser(row.userId, toNotice(row));
  }
  return created.length;
}

export async function notifyUser(params: {
  hospitalId?: string | null;
  userId: string;
  appointmentId?: string | null;
  title: string;
  body: string;
  href?: string | null;
}) {
  const row = await prisma.staffNotification.create({
    data: {
      hospitalId: params.hospitalId ?? null,
      userId: params.userId,
      appointmentId: params.appointmentId ?? null,
      title: params.title,
      body: params.body,
      href: params.href ?? null,
    },
  });
  pushNotificationToUser(row.userId, toNotice(row));
}

export async function notifyWardStaffOfAdmission(params: {
  hospitalId: string;
  admissionId: string;
  patientName: string;
  ipNumber: string;
  bedLabel: string;
}) {
  const body = `${params.patientName} admitted as ${params.ipNumber} to ${params.bedLabel}.`;
  await Promise.all([
    notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "NURSE",
      href: `/wards/stays/${params.admissionId}`,
      title: "New admission on ward",
      body,
    }),
    notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "RECEPTIONIST",
      href: `/wards/stays/${params.admissionId}`,
      title: "Patient admitted",
      body,
    }),
  ]);
}

export async function notifyNursesOfConsult(params: {
  hospitalId: string;
  appointmentId: string;
  patientName: string;
  doctorName: string;
  token?: string | null;
  arrived: boolean;
}) {
  const token = params.token ? ` · ${params.token}` : "";
  return notifyHospitalRole({
    hospitalId: params.hospitalId,
    role: "NURSE",
    appointmentId: params.appointmentId,
    href: `/appointments/${params.appointmentId}`,
    title: params.arrived ? "Patient arrived — record vitals" : "New consult — vitals needed",
    body: params.arrived
      ? `${params.patientName} has checked in with ${params.doctorName}${token}. Record height, weight, and temperature (other vitals optional) before the doctor consult.`
      : `${params.patientName} is booked with ${params.doctorName}${token}. Record vitals when the patient arrives.`,
  });
}

export async function notifyDoctorVitalsReady(params: {
  hospitalId: string;
  doctorAppUserId?: string | null;
  appointmentId: string;
  patientName: string;
  token?: string | null;
}) {
  if (!params.doctorAppUserId) return;
  const token = params.token ? ` · ${params.token}` : "";
  await notifyUser({
    hospitalId: params.hospitalId,
    userId: params.doctorAppUserId,
    appointmentId: params.appointmentId,
    href: `/appointments/${params.appointmentId}`,
    title: "Vitals recorded — patient ready",
    body: `Nurse vitals are saved for ${params.patientName}${token}. Review them when the patient enters the room.`,
  });
}

export async function notifySummaryApproved(params: {
  hospitalId: string;
  appointmentId: string;
  patientName: string;
  doctorName: string;
  token?: string | null;
}) {
  const token = params.token ? ` · ${params.token}` : "";
  const body = `${params.doctorName} approved the visit summary and prescription for ${params.patientName}${token}. It is ready to print.`;
  await Promise.all([
    notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "NURSE",
      appointmentId: params.appointmentId,
      href: `/appointments/${params.appointmentId}`,
      title: "Visit summary approved — print",
      body,
    }),
    notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "RECEPTIONIST",
      appointmentId: params.appointmentId,
      href: `/appointments/${params.appointmentId}`,
      title: "Visit summary approved — print",
      body,
    }),
  ]);
}
