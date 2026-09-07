import type { ReminderChannel } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { FRONT_DESK_ROLES } from "@/lib/authz/hospital";
import { doctorName, patientName, tokenLabel } from "@/lib/display";
import { reminderMessage } from "@/lib/opd/scheduling";
import { prisma } from "@/lib/prisma";
import type { AppointmentActionContext, AppointmentActionResult } from "@/lib/appointments/types";

const CHANNELS: ReminderChannel[] = ["SMS", "WHATSAPP", "EMAIL"];
const DEFAULT_REMIND_CHANNELS: ReminderChannel[] = ["WHATSAPP"];

export async function remindAppointment(
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult> {
  const { request, user, appointment, body } = ctx;
  if (!FRONT_DESK_ROLES.includes(user.role)) {
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
  const message = reminderMessage({
    patient: patientName(appointment.patient),
    doctor: doctorName(appointment.doctor),
    hospital: hospitalName,
    when: appointment.scheduledAt,
    token: appointment.tokenNumber ? tokenLabel(appointment.tokenNumber) : undefined,
  });
  const created = await prisma.$transaction(
    channels.map((channel) =>
      prisma.appointmentReminder.create({
        data: {
          hospitalId: user.hospitalId,
          appointmentId: appointment.id,
          channel,
          status: "PENDING",
          message,
        },
      }),
    ),
  );
  const { enqueueMessage } = await import("@/lib/messaging");
  const variables = {
    patient: patientName(appointment.patient),
    doctor: doctorName(appointment.doctor),
    hospital: hospitalName,
    when: appointment.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    date: appointment.scheduledAt.toLocaleDateString("en-IN", { dateStyle: "medium" }),
    time: appointment.scheduledAt.toLocaleTimeString("en-IN", { timeStyle: "short" }),
    token: appointment.tokenNumber ? tokenLabel(appointment.tokenNumber) : "",
  };
  for (const reminder of created) {
    const queued = await enqueueMessage({
      hospitalId: user.hospitalId,
      patientId: appointment.patientId,
      appointmentId: appointment.id,
      reminderId: reminder.id,
      channel: reminder.channel,
      templateKey: "appointment_reminder",
      variables,
      toPhone: phone,
      patient: appointment.patient,
    });
    if ("error" in queued) {
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: { status: "FAILED" },
      });
    }
  }
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
