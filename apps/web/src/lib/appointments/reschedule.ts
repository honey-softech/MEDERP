import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { FRONT_DESK_ROLES } from "@/lib/authz/hospital";
import { doctorName, patientName } from "@/lib/display";
import { doctorIsOnLeave } from "@/lib/opd/scheduling";
import { prisma } from "@/lib/prisma";
import type { AppointmentActionContext, AppointmentActionResult } from "@/lib/appointments/types";

export async function rescheduleAppointment(
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult> {
  const { request, user, appointment, body } = ctx;
  if (!FRONT_DESK_ROLES.includes(user.role)) {
    return { ok: false, error: "You do not have access to this action.", status: 403 };
  }
  const scheduledAt = new Date(String(body?.scheduledAt ?? ""));
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: "Choose a valid appointment time.", status: 400 };
  }
  if (["CANCELLED", "COMPLETED"].includes(appointment.status)) {
    return { ok: false, error: "This appointment cannot be rescheduled.", status: 409 };
  }
  if (await doctorIsOnLeave(user.hospitalId, appointment.doctorId, scheduledAt)) {
    return {
      ok: false,
      error: `${doctorName(appointment.doctor)} is on leave that day. Choose another date.`,
      status: 409,
    };
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
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
    entityId: appointment.id,
    summary: `${user.username} rescheduled ${patientName(appointment.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { scheduledAt: appointment.scheduledAt, status: appointment.status },
        { scheduledAt: updated.scheduledAt, status: updated.status },
        { fields: ["scheduledAt", "status"] },
      ),
    },
  });
  return { ok: true, body: { ok: true, appointment: updated } };
}
