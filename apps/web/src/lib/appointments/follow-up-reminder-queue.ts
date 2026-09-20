import type { ReminderChannel, ReminderSource } from "@prisma/client";
import { doctorName, patientName, tokenLabel } from "@/lib/display";
import { reminderMessage } from "@/lib/opd/scheduling";
import { prisma } from "@/lib/prisma";
import {
  followUpReminderEnabled,
  followUpReminderSendAt,
  parseFollowUpReminderDaysBefore,
  sameFollowUpVisitDay,
  type FollowUpReminderPolicy,
} from "@/lib/appointments/follow-up-reminder";

const DEFAULT_CHANNEL: ReminderChannel = "WHATSAPP";

type ReminderVisit = {
  id: string;
  hospitalId: string;
  patientId: string;
  scheduledAt: Date;
  tokenNumber: number | null;
  status: string;
  patient: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    smsOptIn?: boolean | null;
    whatsappOptIn?: boolean | null;
  };
  doctor: Parameters<typeof doctorName>[0];
};

function reminderVariables(params: {
  appointment: ReminderVisit;
  hospitalName: string;
  visitAt: Date;
}) {
  const when = params.visitAt;
  return {
    patient: patientName(params.appointment.patient),
    doctor: doctorName(params.appointment.doctor),
    hospital: params.hospitalName,
    when: when.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    date: when.toLocaleDateString("en-IN", { dateStyle: "medium" }),
    time: when.toLocaleTimeString("en-IN", { timeStyle: "short" }),
    token: params.appointment.tokenNumber ? tokenLabel(params.appointment.tokenNumber) : "",
  };
}

export async function enqueueOutboundForReminder(params: {
  reminderId: string;
  channel: ReminderChannel;
  appointment: ReminderVisit;
  hospitalName: string;
  visitAt: Date;
}) {
  const phone = params.appointment.patient.phone?.replace(/\D/g, "") ?? "";
  if (phone.length < 10) {
    await prisma.appointmentReminder.update({
      where: { id: params.reminderId },
      data: { status: "FAILED" },
    });
    return { ok: false as const, error: "Patient needs a 10-digit mobile number." };
  }
  const { enqueueMessage } = await import("@/lib/messaging/queue");
  const queued = await enqueueMessage({
    hospitalId: params.appointment.hospitalId,
    patientId: params.appointment.patientId,
    appointmentId: params.appointment.id,
    reminderId: params.reminderId,
    channel: params.channel,
    templateKey: "appointment_reminder",
    variables: reminderVariables(params),
    toPhone: phone,
    patient: params.appointment.patient,
  });
  if ("error" in queued) {
    await prisma.appointmentReminder.update({
      where: { id: params.reminderId },
      data: { status: "FAILED" },
    });
    return { ok: false as const, error: queued.error };
  }
  return { ok: true as const };
}

export async function createAppointmentReminders(params: {
  hospitalId: string;
  hospitalName: string;
  appointment: ReminderVisit;
  channels: ReminderChannel[];
  source: ReminderSource;
  visitAt: Date;
  scheduledFor: Date;
}) {
  const now = new Date();
  const sendNow = params.scheduledFor.getTime() <= now.getTime();
  const message = reminderMessage({
    patient: patientName(params.appointment.patient),
    doctor: doctorName(params.appointment.doctor),
    hospital: params.hospitalName,
    when: params.visitAt,
    token: params.appointment.tokenNumber ? tokenLabel(params.appointment.tokenNumber) : undefined,
  });
  const created = await prisma.$transaction(
    params.channels.map((channel) =>
      prisma.appointmentReminder.create({
        data: {
          hospitalId: params.hospitalId,
          appointmentId: params.appointment.id,
          channel,
          status: "PENDING",
          source: params.source,
          message,
          visitAt: params.visitAt,
          scheduledFor: params.scheduledFor,
        },
      }),
    ),
  );
  if (sendNow) {
    for (const reminder of created) {
      await enqueueOutboundForReminder({
        reminderId: reminder.id,
        channel: reminder.channel,
        appointment: params.appointment,
        hospitalName: params.hospitalName,
        visitAt: params.visitAt,
      });
    }
  }
  return created;
}

export async function cancelPendingFollowUpReminders(appointmentId: string) {
  await prisma.appointmentReminder.updateMany({
    where: { appointmentId, source: "FOLLOW_UP", status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

export async function cancelPendingRemindersForAppointment(appointmentId: string) {
  await prisma.appointmentReminder.updateMany({
    where: { appointmentId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

async function hospitalPolicy(hospitalId: string, provided?: FollowUpReminderPolicy | null) {
  if (provided) return provided;
  return prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { followUpReminderEnabled: true, followUpReminderDaysBefore: true, name: true },
  });
}

export async function scheduleFollowUpReminder(params: {
  hospitalId: string;
  appointmentId: string;
  visitAt: Date;
  hospital?: (FollowUpReminderPolicy & { name?: string | null }) | null;
}) {
  const policy = await hospitalPolicy(params.hospitalId, params.hospital);
  if (!followUpReminderEnabled(policy)) {
    await cancelPendingFollowUpReminders(params.appointmentId);
    return { scheduled: false as const, reason: "disabled" };
  }

  const sendAt = followUpReminderSendAt(
    params.visitAt,
    parseFollowUpReminderDaysBefore(policy?.followUpReminderDaysBefore),
  );
  if (!sendAt) {
    await cancelPendingFollowUpReminders(params.appointmentId);
    return { scheduled: false as const, reason: "too-soon" };
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, hospitalId: params.hospitalId },
    include: {
      patient: true,
      doctor: { include: { appUser: { select: { username: true } } } },
      hospital: { select: { name: true } },
    },
  });
  if (!appointment || ["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    await cancelPendingFollowUpReminders(params.appointmentId);
    return { scheduled: false as const, reason: "unavailable" };
  }

  const phone = appointment.patient.phone?.replace(/\D/g, "") ?? "";
  if (phone.length < 10) {
    await cancelPendingFollowUpReminders(params.appointmentId);
    return { scheduled: false as const, reason: "no-phone" };
  }

  const existing = await prisma.appointmentReminder.findFirst({
    where: {
      appointmentId: appointment.id,
      source: "FOLLOW_UP",
      status: { in: ["PENDING", "SENT"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.visitAt && sameFollowUpVisitDay(existing.visitAt, params.visitAt)) {
    return { scheduled: true as const, sendAt, reused: true };
  }

  await cancelPendingFollowUpReminders(appointment.id);
  await createAppointmentReminders({
    hospitalId: params.hospitalId,
    hospitalName: appointment.hospital.name || "the hospital",
    appointment,
    channels: [DEFAULT_CHANNEL],
    source: "FOLLOW_UP",
    visitAt: params.visitAt,
    scheduledFor: sendAt,
  });
  return { scheduled: true as const, sendAt, reused: false };
}

export async function processDueFollowUpReminders() {
  const now = new Date();
  const due = await prisma.appointmentReminder.findMany({
    where: {
      status: "PENDING",
      source: "FOLLOW_UP",
      scheduledFor: { lte: now },
    },
    include: {
      hospital: { select: { name: true } },
      appointment: {
        include: {
          patient: true,
          doctor: { include: { appUser: { select: { username: true } } } },
        },
      },
    },
    orderBy: { scheduledFor: "asc" },
    take: 40,
  });

  let sent = 0;
  let skipped = 0;
  for (const reminder of due) {
    const alreadyQueued = await prisma.outboundMessage.findFirst({
      where: { reminderId: reminder.id },
      select: { id: true },
    });
    if (alreadyQueued) {
      skipped += 1;
      continue;
    }
    if (["CANCELLED", "NO_SHOW"].includes(reminder.appointment.status)) {
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: { status: "CANCELLED" },
      });
      skipped += 1;
      continue;
    }
    const result = await enqueueOutboundForReminder({
      reminderId: reminder.id,
      channel: reminder.channel,
      appointment: reminder.appointment,
      hospitalName: reminder.hospital.name ?? "the hospital",
      visitAt: reminder.visitAt ?? reminder.appointment.scheduledAt,
    });
    if (result.ok) sent += 1;
  }
  return { processed: due.length, sent, skipped };
}
