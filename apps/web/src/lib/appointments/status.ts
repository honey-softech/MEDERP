import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { DOCTOR_VISIT_ROLES, FRONT_DESK_ROLES } from "@/lib/authz/hospital";
import { doctorName, patientName, tokenLabel } from "@/lib/display";
import { nextToken } from "@/lib/ids";
import { notifyNursesOfConsult } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { doctorOwnsVisit } from "@/lib/appointments/access";
import type { AppointmentActionContext, AppointmentActionResult } from "@/lib/appointments/types";

function noAccess(): AppointmentActionResult {
  return { ok: false, error: "You do not have access to this action.", status: 403 };
}

export async function cancelAppointment(
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult> {
  const { request, user, appointment } = ctx;
  if (!FRONT_DESK_ROLES.includes(user.role)) return noAccess();
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
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
    entityId: appointment.id,
    summary: `${user.username} cancelled appointment for ${patientName(appointment.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { status: appointment.status, cancelledAt: appointment.cancelledAt },
        { status: updated.status, cancelledAt: updated.cancelledAt },
        { fields: ["status", "cancelledAt"] },
      ),
    },
  });
  return { ok: true, body: { ok: true, appointment: updated } };
}

export async function checkInAppointment(
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult> {
  const { request, user, appointment } = ctx;
  if (!FRONT_DESK_ROLES.includes(user.role)) return noAccess();
  if (["CANCELLED", "COMPLETED"].includes(appointment.status)) {
    return { ok: false, error: "This appointment cannot be checked in.", status: 409 };
  }
  const tokenNumber =
    appointment.tokenNumber ??
    (await nextToken(user.hospitalId, appointment.doctorId, appointment.scheduledAt));
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
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
    entityId: appointment.id,
    summary: `${user.username} checked in ${patientName(appointment.patient)} (${tokenLabel(tokenNumber)}).`,
    metadata: {
      changes: diffAuditFields(
        { status: appointment.status, checkInAt: appointment.checkInAt, tokenNumber: appointment.tokenNumber },
        { status: updated.status, checkInAt: updated.checkInAt, tokenNumber: updated.tokenNumber },
        { fields: ["status", "checkInAt", "tokenNumber"] },
      ),
    },
  });
  const alreadyRecorded = await prisma.visitVitals.findUnique({
    where: { appointmentId: appointment.id },
    select: { id: true },
  });
  if (!alreadyRecorded) {
    await notifyNursesOfConsult({
      hospitalId: user.hospitalId,
      appointmentId: appointment.id,
      patientName: patientName(appointment.patient),
      doctorName: doctorName(appointment.doctor),
      token: tokenLabel(tokenNumber),
      arrived: true,
    });
  }
  return { ok: true, body: { ok: true, appointment: updated } };
}

export async function startAppointment(
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult> {
  const { request, user, appointment } = ctx;
  const isFrontDesk = FRONT_DESK_ROLES.includes(user.role);
  const isDoctorVisit = DOCTOR_VISIT_ROLES.includes(user.role);
  if (!isDoctorVisit && !isFrontDesk) return noAccess();
  const owned = await doctorOwnsVisit(ctx);
  if (owned) return owned;
  if (!["CHECKED_IN", "SCHEDULED"].includes(appointment.status)) {
    return { ok: false, error: "This visit cannot be started.", status: 409 };
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
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
    entityId: appointment.id,
    summary: `${user.username} started consult for ${patientName(appointment.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { status: appointment.status, checkInAt: appointment.checkInAt },
        { status: updated.status, checkInAt: updated.checkInAt },
        { fields: ["status", "checkInAt"] },
      ),
    },
  });
  return { ok: true, body: { ok: true, appointment: updated } };
}

export async function closeAppointment(
  ctx: AppointmentActionContext,
  action: "checkout" | "complete",
): Promise<AppointmentActionResult> {
  const { request, user, appointment } = ctx;
  const isFrontDesk = FRONT_DESK_ROLES.includes(user.role);
  const isDoctorVisit = DOCTOR_VISIT_ROLES.includes(user.role);
  if (action === "checkout" && !isFrontDesk && !isDoctorVisit) return noAccess();
  if (action === "complete" && !isDoctorVisit && !isFrontDesk) return noAccess();
  if (isDoctorVisit && user.role === "DOCTOR") {
    const owned = await doctorOwnsVisit(ctx);
    if (owned) return owned;
  }
  if (["CANCELLED", "COMPLETED"].includes(appointment.status)) {
    return { ok: false, error: "This visit is already closed.", status: 409 };
  }
  if (action === "complete") {
    const assessment = await prisma.visitAssessment.findUnique({
      where: { appointmentId: appointment.id },
      select: { status: true },
    });
    if (assessment?.status !== "APPROVED") {
      return {
        ok: false,
        error: "Approve the visit summary and prescription before marking the visit done.",
        status: 409,
      };
    }
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
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
    entityId: appointment.id,
    summary:
      action === "complete"
        ? `${user.username} marked visit done for ${patientName(appointment.patient)}.`
        : `${user.username} checked out ${patientName(appointment.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { status: appointment.status, checkOutAt: appointment.checkOutAt },
        { status: updated.status, checkOutAt: updated.checkOutAt },
        { fields: ["status", "checkOutAt"] },
      ),
    },
  });
  return { ok: true, body: { ok: true, appointment: updated } };
}

export async function markNoShow(
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult> {
  const { user, appointment } = ctx;
  if (!FRONT_DESK_ROLES.includes(user.role)) return noAccess();
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "NO_SHOW" },
  });
  return { ok: true, body: { ok: true, appointment: updated } };
}
