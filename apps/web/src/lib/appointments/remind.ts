import type { ReminderChannel } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { hasFrontDeskAccess } from "@/lib/authz/hospital";
import { createAppointmentReminders } from "@/lib/appointments/follow-up-reminder-queue";
import { doctorName, patientName, tokenLabel } from "@/lib/display";
import { reminderMessage } from "@/lib/opd/scheduling";
import type { AppointmentActionContext, AppointmentActionResult } from "@/lib/appointments/types";

const CHANNELS: ReminderChannel[] = ["SMS", "WHATSAPP", "EMAIL"];
const DEFAULT_REMIND_CHANNELS: ReminderChannel[] = ["WHATSAPP"];

export async function remindAppointment(
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult> {
  const { request, user, appointment, body } = ctx;
  if (!hasFrontDeskAccess(user)) {
    return { ok: false, error: "You do not have access to this action.", status: 403 };
  }
  const requested: string[] = Array.isArray(body?.channels)
    ? body.channels.map((channel: unknown) => String(channel))
    : DEFAULT_REMIND_CHANNELS;
  const channels = requested.filter((channel): channel is ReminderChannel =>
    CHANNELS.includes(channel as ReminderChannel),
  );
  if (channels.length === 0) {
    return { ok: false, error: "Select at least one reminder channel.", status: 400 };
  }
  const phone = appointment.patient.phone?.replace(/\D/g, "") ?? "";
  if (phone.length < 10) {
    return {
      ok: false,
      error: "Add a 10-digit mobile number on the patient record first.",
      status: 400,
    };
  }
  const hospitalName = user.hospital?.name ?? "the hospital";
  const now = new Date();
  const message = reminderMessage({
    patient: patientName(appointment.patient),
    doctor: doctorName(appointment.doctor),
    hospital: hospitalName,
    when: appointment.scheduledAt,
    token: appointment.tokenNumber ? tokenLabel(appointment.tokenNumber) : undefined,
  });
  await createAppointmentReminders({
    hospitalId: user.hospitalId,
    hospitalName,
    appointment,
    channels,
    source: "MANUAL",
    visitAt: appointment.scheduledAt,
    scheduledFor: now,
  });
  await writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "APPOINTMENT_REMINDER",
    entity: "Appointment",
    entityId: appointment.id,
    summary: `${user.username} queued ${channels.join(", ")} reminders for ${patientName(appointment.patient)}.`,
    metadata: { channels },
  });
  return { ok: true, body: { ok: true, message, channels, status: "PENDING" } };
}
