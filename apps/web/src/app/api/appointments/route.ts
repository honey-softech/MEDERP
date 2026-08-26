import { NextResponse } from "next/server";
import type { QueueType, ReferralSource, VisitType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  CLINICAL_VIEW_ROLES,
  FRONT_DESK_ROLES,
  WALK_IN_ROLES,
  doctorIsOnLeave,
  doctorName,
  forbidUnless,
  nextToken,
  patientName,
  requireHospitalActor,
  sanitizePhotoData,
  staffIdForAppUser,
  tokenLabel,
} from "@/lib/front-desk";
import { notifyNursesOfConsult } from "@/lib/notifications";

const QUEUE_TYPES: QueueType[] = ["SCHEDULED", "WALK_IN"];
const VISIT_TYPES: VisitType[] = ["NEW", "FOLLOW_UP", "EMERGENCY"];
const REFERRALS: ReferralSource[] = ["SELF", "DOCTOR", "INSURANCE"];

export async function GET(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, CLINICAL_VIEW_ROLES);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId") ?? undefined;
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const appointments = await prisma.appointment.findMany({
    where: {
      hospitalId: scoped.user.hospitalId,
      ...(doctorId ? { doctorId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(from || to
        ? {
            scheduledAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lt: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      patient: true,
      doctor: { include: { appUser: { select: { username: true } } } },
      department: true,
    },
  });

  return NextResponse.json({ appointments });
}

export async function POST(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const canFrontDesk = FRONT_DESK_ROLES.includes(scoped.user.role);
  const canWalkIn = WALK_IN_ROLES.includes(scoped.user.role);
  if (!canWalkIn) {
    const denied = forbidUnless(scoped.user.role, WALK_IN_ROLES);
    if (denied) return denied;
  }

  const body = await request.json().catch(() => null);
  const patientId = String(body?.patientId ?? "");
  let doctorId = String(body?.doctorId ?? "");
  const departmentId = String(body?.departmentId ?? "");
  const queueType = (String(body?.queueType ?? "SCHEDULED") as QueueType);

  if (!canFrontDesk) {
    if (queueType !== "WALK_IN") {
      return NextResponse.json({ error: "Doctors can add walk-ins to their own queue." }, { status: 403 });
    }
    const myStaffId = await staffIdForAppUser(scoped.user.id, scoped.user.hospitalId);
    if (!myStaffId) {
      return NextResponse.json({ error: "Your doctor profile is not linked. Ask the hospital admin." }, { status: 400 });
    }
    doctorId = myStaffId;
  }
  const visitType = (String(body?.visitType ?? "NEW") as VisitType);
  const referralSource = (String(body?.referralSource ?? "SELF") as ReferralSource);
  const referredBy = String(body?.referredBy ?? "").trim() || null;
  const reason = String(body?.reason ?? "").trim() || null;
  const notes = String(body?.notes ?? "").trim() || null;
  const photoData = sanitizePhotoData(body?.photoData);
  const checkInNow = Boolean(body?.checkInNow);
  const scheduledAt = body?.scheduledAt ? new Date(String(body.scheduledAt)) : new Date();

  if (!QUEUE_TYPES.includes(queueType) || !VISIT_TYPES.includes(visitType) || !REFERRALS.includes(referralSource)) {
    return NextResponse.json({ error: "Invalid visit, queue, or referral type." }, { status: 400 });
  }
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Choose a valid appointment time." }, { status: 400 });
  }

  const [patient, doctor, department] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: patientId, hospitalId: scoped.user.hospitalId, mergedIntoId: null },
    }),
    prisma.staff.findFirst({
      where: {
        id: doctorId,
        hospitalId: scoped.user.hospitalId,
        role: "DOCTOR",
        isActive: true,
        appUserId: { not: null },
      },
      include: { appUser: { select: { username: true } } },
    }),
    prisma.department.findFirst({ where: { id: departmentId, hospitalId: scoped.user.hospitalId } }),
  ]);
  if (!patient || !doctor || !department) {
    return NextResponse.json({ error: "Patient, doctor, and department must belong to this hospital." }, { status: 400 });
  }
  if (await doctorIsOnLeave(scoped.user.hospitalId, doctor.id, scheduledAt)) {
    return NextResponse.json({ error: `${doctorName(doctor)} is on leave at the selected time.` }, { status: 409 });
  }

  const walkIn = queueType === "WALK_IN";
  const shouldCheckIn = walkIn || checkInNow;
  const tokenNumber = await nextToken(scoped.user.hospitalId, doctor.id, scheduledAt);

  const appointment = await prisma.appointment.create({
    data: {
      hospitalId: scoped.user.hospitalId,
      patientId: patient.id,
      doctorId: doctor.id,
      departmentId: department.id,
      scheduledAt,
      queueType,
      visitType,
      referralSource,
      referredBy,
      reason,
      notes,
      photoData,
      tokenNumber,
      status: shouldCheckIn ? "CHECKED_IN" : "SCHEDULED",
      checkInAt: shouldCheckIn ? new Date() : null,
    },
    include: { patient: true, doctor: { include: { appUser: { select: { username: true } } } }, department: true },
  });

  if (photoData && !patient.photoData) {
    await prisma.patient.update({ where: { id: patient.id }, data: { photoData } });
  }

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: walkIn ? "WALK_IN_CREATED" : "APPOINTMENT_BOOKED",
    entity: "Appointment",
    entityId: appointment.id,
    summary: `${scoped.user.username} booked ${patientName(patient)} with ${doctorName(doctor)} (${tokenLabel(tokenNumber)}).`,
  });

  await notifyNursesOfConsult({
    hospitalId: scoped.user.hospitalId,
    appointmentId: appointment.id,
    patientName: patientName(patient),
    doctorName: doctorName(doctor),
    token: tokenLabel(tokenNumber),
    arrived: shouldCheckIn,
  });

  return NextResponse.json({ ok: true, appointment });
}
