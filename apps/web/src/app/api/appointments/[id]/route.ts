import { NextResponse } from "next/server";
import type { ReminderChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  DOCTOR_VISIT_ROLES,
  FRONT_DESK_ROLES,
  doctorIsOnLeave,
  doctorName,
  forbidUnless,
  nextToken,
  patientName,
  reminderMessage,
  requireHospitalActor,
  sanitizePhotoData,
  staffIdForAppUser,
  tokenLabel,
} from "@/lib/front-desk";
import { notifyNursesOfConsult } from "@/lib/notifications";

const CHANNELS: ReminderChannel[] = ["SMS", "WHATSAPP", "EMAIL"];

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const user = scoped.user;

  const { id } = await context.params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: { patient: true, doctor: { include: { appUser: { select: { username: true } } } }, department: true },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }
  const appt = appointment;

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const hospitalName = user.hospital?.name ?? "the hospital";
  const isFrontDesk = FRONT_DESK_ROLES.includes(user.role);
  const isDoctorVisit = DOCTOR_VISIT_ROLES.includes(user.role);

  async function doctorOwnsVisit() {
    if (user.role === "SUPER_ADMIN") return null;
    const staffId = await staffIdForAppUser(user.id, user.hospitalId);
    if (!staffId || appt.doctorId !== staffId) {
      return NextResponse.json({ error: "You can only update your own consults." }, { status: 403 });
    }
    return null;
  }

  if (action === "reschedule") {
    const denied = forbidUnless(user.role, FRONT_DESK_ROLES);
    if (denied) return denied;
    const scheduledAt = new Date(String(body?.scheduledAt ?? ""));
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "Choose a valid appointment time." }, { status: 400 });
    }
    if (["CANCELLED", "COMPLETED"].includes(appointment.status)) {
      return NextResponse.json({ error: "This appointment cannot be rescheduled." }, { status: 409 });
    }
    if (await doctorIsOnLeave(user.hospitalId, appointment.doctorId, scheduledAt)) {
      return NextResponse.json({ error: `${doctorName(appointment.doctor)} is on leave at the selected time.` }, { status: 409 });
    }
    const updated = await prisma.appointment.update({
      where: { id },
      data: { scheduledAt, status: appointment.status === "NO_SHOW" ? "SCHEDULED" : appointment.status },
    });
    await writeAuditLog({
      request,
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "APPOINTMENT_RESCHEDULED",
      entity: "Appointment",
      entityId: id,
      summary: `${user.username} rescheduled ${patientName(appointment.patient)}.`,
    });
    return NextResponse.json({ ok: true, appointment: updated });
  }

  if (action === "cancel") {
    const denied = forbidUnless(user.role, FRONT_DESK_ROLES);
    if (denied) return denied;
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await writeAuditLog({
      request,
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "APPOINTMENT_CANCELLED",
      entity: "Appointment",
      entityId: id,
      summary: `${user.username} cancelled appointment for ${patientName(appointment.patient)}.`,
    });
    return NextResponse.json({ ok: true, appointment: updated });
  }

  if (action === "checkin") {
    const denied = forbidUnless(user.role, FRONT_DESK_ROLES);
    if (denied) return denied;
    if (["CANCELLED", "COMPLETED"].includes(appointment.status)) {
      return NextResponse.json({ error: "This appointment cannot be checked in." }, { status: 409 });
    }
    const tokenNumber =
      appointment.tokenNumber ??
      (await nextToken(user.hospitalId, appointment.doctorId, appointment.scheduledAt));
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CHECKED_IN",
        checkInAt: appointment.checkInAt ?? new Date(),
        tokenNumber,
      },
    });
    await writeAuditLog({
      request,
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "PATIENT_CHECKED_IN",
      entity: "Appointment",
      entityId: id,
      summary: `${user.username} checked in ${patientName(appointment.patient)} (${tokenLabel(tokenNumber)}).`,
    });
    const alreadyRecorded = await prisma.visitVitals.findUnique({
      where: { appointmentId: id },
      select: { id: true },
    });
    if (!alreadyRecorded) {
      await notifyNursesOfConsult({
        hospitalId: user.hospitalId,
        appointmentId: id,
        patientName: patientName(appointment.patient),
        doctorName: doctorName(appointment.doctor),
        token: tokenLabel(tokenNumber),
        arrived: true,
      });
    }
    return NextResponse.json({ ok: true, appointment: updated });
  }

  if (action === "start") {
    if (!isDoctorVisit && !isFrontDesk) {
      return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
    }
    const owned = await doctorOwnsVisit();
    if (owned) return owned;
    if (!["CHECKED_IN", "SCHEDULED"].includes(appointment.status)) {
      return NextResponse.json({ error: "This visit cannot be started." }, { status: 409 });
    }
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        checkInAt: appointment.checkInAt ?? new Date(),
      },
    });
    await writeAuditLog({
      request,
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "CONSULT_STARTED",
      entity: "Appointment",
      entityId: id,
      summary: `${user.username} started consult for ${patientName(appointment.patient)}.`,
    });
    return NextResponse.json({ ok: true, appointment: updated });
  }

  if (action === "checkout" || action === "complete") {
    if (action === "checkout" && !isFrontDesk && !isDoctorVisit) {
      return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
    }
    if (action === "complete" && !isDoctorVisit && !isFrontDesk) {
      return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
    }
    if (isDoctorVisit && user.role === "DOCTOR") {
      const owned = await doctorOwnsVisit();
      if (owned) return owned;
    }
    if (["CANCELLED", "COMPLETED"].includes(appointment.status)) {
      return NextResponse.json({ error: "This visit is already closed." }, { status: 409 });
    }
    if (action === "complete") {
      const assessment = await prisma.visitAssessment.findUnique({
        where: { appointmentId: id },
        select: { status: true },
      });
      if (assessment?.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Approve the visit summary and prescription before marking the visit done." },
          { status: 409 },
        );
      }
    }
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "COMPLETED", checkOutAt: new Date() },
    });
    await writeAuditLog({
      request,
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: action === "complete" ? "VISIT_COMPLETED" : "PATIENT_CHECKED_OUT",
      entity: "Appointment",
      entityId: id,
      summary:
        action === "complete"
          ? `${user.username} marked visit done for ${patientName(appointment.patient)}.`
          : `${user.username} checked out ${patientName(appointment.patient)}.`,
    });
    return NextResponse.json({ ok: true, appointment: updated });
  }

  if (action === "noshow") {
    const denied = forbidUnless(user.role, FRONT_DESK_ROLES);
    if (denied) return denied;
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "NO_SHOW" },
    });
    return NextResponse.json({ ok: true, appointment: updated });
  }

  if (action === "remind") {
    const denied = forbidUnless(user.role, FRONT_DESK_ROLES);
    if (denied) return denied;
    const requested: string[] = Array.isArray(body?.channels) ? body.channels.map((channel: unknown) => String(channel)) : CHANNELS;
    const channels = requested.filter((channel): channel is ReminderChannel =>
      CHANNELS.includes(channel as ReminderChannel),
    );
    if (channels.length === 0) {
      return NextResponse.json({ error: "Select at least one reminder channel." }, { status: 400 });
    }
    const message = reminderMessage({
      patient: patientName(appointment.patient),
      doctor: doctorName(appointment.doctor),
      hospital: hospitalName,
      when: appointment.scheduledAt,
      token: appointment.tokenNumber ? tokenLabel(appointment.tokenNumber) : undefined,
    });
    await prisma.appointmentReminder.createMany({
      data: channels.map((channel) => ({
        hospitalId: user.hospitalId,
        appointmentId: appointment.id,
        channel,
        status: "SENT",
        message,
        sentAt: new Date(),
      })),
    });
    await prisma.appointment.update({
      where: { id },
      data: { reminderSentAt: new Date() },
    });
    await writeAuditLog({
      request,
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "APPOINTMENT_REMINDER",
      entity: "Appointment",
      entityId: id,
      summary: `${user.username} queued ${channels.join(", ")} reminders for ${patientName(appointment.patient)}.`,
      metadata: { channels, note: "Logged in MedERP. Connect an SMS/WhatsApp/email gateway to deliver." },
    });
    return NextResponse.json({ ok: true, message, channels });
  }

  if (action === "photo") {
    const denied = forbidUnless(user.role, FRONT_DESK_ROLES);
    if (denied) return denied;
    const photoData = sanitizePhotoData(body?.photoData);
    if (!photoData) {
      return NextResponse.json({ error: "Capture a photo first." }, { status: 400 });
    }
    const updated = await prisma.appointment.update({
      where: { id },
      data: { photoData },
    });
    if (!appointment.patient.photoData) {
      await prisma.patient.update({ where: { id: appointment.patientId }, data: { photoData } });
    }
    await writeAuditLog({
      request,
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "VISIT_PHOTO_CAPTURED",
      entity: "Appointment",
      entityId: id,
      summary: `${user.username} captured a visit photo for ${patientName(appointment.patient)}.`,
    });
    return NextResponse.json({ ok: true, appointment: updated });
  }

  return NextResponse.json({ error: "Unknown appointment action." }, { status: 400 });
}
