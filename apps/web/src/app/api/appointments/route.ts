import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  CLINICAL_VIEW_ROLES,
  FRONT_DESK_ROLES,
  canAddWalkIn,
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
import { staffIdsOnApprovedLeave } from "@/lib/staff-leave";
import { notifyNursesOfConsult } from "@/lib/notifications";
import { createAppointmentSchema } from "@/lib/validation/appointment";
import { parseJsonBody } from "@/lib/validation/parse";

export async function GET(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, CLINICAL_VIEW_ROLES);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const leaveAtRaw = searchParams.get("leaveAt");
  if (leaveAtRaw) {
    const at = new Date(leaveAtRaw);
    if (Number.isNaN(at.getTime())) {
      return NextResponse.json({ error: "Choose a valid appointment date." }, { status: 400 });
    }
    const doctors = await prisma.staff.findMany({
      where: { hospitalId: scoped.user.hospitalId, role: "DOCTOR" },
      select: { id: true },
    });
    const onLeaveDoctorIds = await staffIdsOnApprovedLeave(
      scoped.user.hospitalId,
      doctors.map((row) => row.id),
      at,
    );
    return NextResponse.json({ onLeaveDoctorIds });
  }

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
  const canWalkIn = canAddWalkIn(scoped.user);
  if (!canWalkIn) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }

  const parsed = await parseJsonBody(request, createAppointmentSchema);
  if (!parsed.ok) return parsed.response;
  const {
    patientId,
    departmentId,
    queueType,
    visitType,
    referralSource,
    referredBy,
    reason,
    notes,
    checkInNow,
    scheduledAt,
  } = parsed.data;
  let doctorId = parsed.data.doctorId;
  const photoData = sanitizePhotoData(parsed.data.photoData);

  if (!canFrontDesk) {
    if (queueType !== "WALK_IN") {
      return NextResponse.json(
        {
          error:
            scoped.user.role === "NURSE"
              ? "Nurses can add walk-ins. Ask reception to book a scheduled visit."
              : "Doctors can add walk-ins to their own queue.",
        },
        { status: 403 },
      );
    }
    if (scoped.user.role === "DOCTOR") {
      const myStaffId = await staffIdForAppUser(scoped.user.id, scoped.user.hospitalId);
      if (!myStaffId) {
        return NextResponse.json({ error: "Your doctor profile is not linked. Ask the hospital admin." }, { status: 400 });
      }
      doctorId = myStaffId;
    }
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
    return NextResponse.json(
      { error: `${doctorName(doctor)} is on leave that day. Choose another doctor or another date.` },
      { status: 409 },
    );
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
