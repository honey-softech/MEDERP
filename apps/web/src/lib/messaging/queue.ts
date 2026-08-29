import type { Prisma, ReminderChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deliverMessage } from "@/lib/messaging/providers";
import {
  channelAllowedForPatient,
  renderTemplate,
  type MessageTemplateKey,
} from "@/lib/messaging/templates";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;

export async function enqueueMessage(params: {
  hospitalId: string;
  patientId?: string | null;
  appointmentId?: string | null;
  reminderId?: string | null;
  channel: ReminderChannel;
  templateKey: MessageTemplateKey;
  variables: Record<string, string>;
  toPhone: string;
  patient?: { smsOptIn?: boolean | null; whatsappOptIn?: boolean | null } | null;
}) {
  const toPhone = params.toPhone.replace(/\D/g, "");
  if (toPhone.length < 10) {
    return { error: "Patient needs a valid 10-digit mobile number." as const };
  }
  if (!channelAllowedForPatient(params.channel, params.patient ?? null)) {
    return { error: "Patient has opted out of this channel." as const };
  }

  const body = renderTemplate(params.templateKey, params.variables);
  const row = await prisma.outboundMessage.create({
    data: {
      hospitalId: params.hospitalId,
      patientId: params.patientId ?? null,
      appointmentId: params.appointmentId ?? null,
      reminderId: params.reminderId ?? null,
      channel: params.channel,
      templateKey: params.templateKey,
      variables: params.variables as Prisma.InputJsonValue,
      toPhone,
      body,
      status: "PENDING",
    },
  });
  return { message: row };
}

export async function processOutboundQueue() {
  const pending = await prisma.outboundMessage.findMany({
    where: { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });
  let sent = 0;
  let failed = 0;
  for (const row of pending) {
    await prisma.outboundMessage.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    const result = await deliverMessage({
      toPhone: row.toPhone,
      channel: row.channel,
      body: row.body,
      templateKey: row.templateKey,
    });
    if (result.ok) {
      sent += 1;
      await prisma.outboundMessage.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.providerMessageId ?? null,
          error: null,
        },
      });
      if (row.reminderId) {
        await prisma.appointmentReminder.updateMany({
          where: { id: row.reminderId },
          data: { status: "SENT", sentAt: new Date() },
        });
      }
    } else {
      const attempts = row.attempts + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      if (giveUp) failed += 1;
      await prisma.outboundMessage.update({
        where: { id: row.id },
        data: {
          status: giveUp ? "FAILED" : "PENDING",
          error: result.error,
        },
      });
      if (giveUp && row.reminderId) {
        await prisma.appointmentReminder.updateMany({
          where: { id: row.reminderId },
          data: { status: "FAILED" },
        });
      }
    }
  }
  return { processed: pending.length, sent, failed };
}

export function startOutboundMessageWorker() {
  const tick = () => {
    void processOutboundQueue().catch((error) => {
      console.error("Outbound message worker failed", error);
    });
  };
  tick();
  return setInterval(tick, 15_000);
}
