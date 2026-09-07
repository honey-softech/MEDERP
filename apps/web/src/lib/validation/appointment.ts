import { z } from "zod";

const QUEUE_TYPES = ["SCHEDULED", "WALK_IN"] as const;
const VISIT_TYPES = ["NEW", "FOLLOW_UP", "EMERGENCY"] as const;
const REFERRALS = ["SELF", "DOCTOR", "INSURANCE"] as const;
const PATCH_ACTIONS = [
  "reschedule",
  "cancel",
  "checkin",
  "start",
  "checkout",
  "complete",
  "noshow",
  "remind",
  "photo",
] as const;
const CHANNELS = ["SMS", "WHATSAPP", "EMAIL"] as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  return text(value) || null;
}

export const createAppointmentSchema = z
  .object({
    patientId: z.unknown().optional(),
    doctorId: z.unknown().optional(),
    departmentId: z.unknown().optional(),
    queueType: z.unknown().optional(),
    visitType: z.unknown().optional(),
    referralSource: z.unknown().optional(),
    referredBy: z.unknown().optional(),
    reason: z.unknown().optional(),
    notes: z.unknown().optional(),
    photoData: z.unknown().optional(),
    checkInNow: z.unknown().optional(),
    scheduledAt: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const patientId = text(data.patientId);
    const doctorId = text(data.doctorId);
    const departmentId = text(data.departmentId);
    const queueType = (text(data.queueType) || "SCHEDULED") as (typeof QUEUE_TYPES)[number];
    const visitType = (text(data.visitType) || "NEW") as (typeof VISIT_TYPES)[number];
    const referralSource = (text(data.referralSource) || "SELF") as (typeof REFERRALS)[number];
    if (!patientId || !departmentId) {
      ctx.addIssue({
        code: "custom",
        message: "Patient, doctor, and department must belong to this hospital.",
      });
      return z.NEVER;
    }
    if (
      !(QUEUE_TYPES as readonly string[]).includes(queueType) ||
      !(VISIT_TYPES as readonly string[]).includes(visitType) ||
      !(REFERRALS as readonly string[]).includes(referralSource)
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid visit, queue, or referral type." });
      return z.NEVER;
    }
    const scheduledAt = data.scheduledAt ? new Date(String(data.scheduledAt)) : new Date();
    if (Number.isNaN(scheduledAt.getTime())) {
      ctx.addIssue({ code: "custom", message: "Choose a valid appointment time." });
      return z.NEVER;
    }
    return {
      patientId,
      doctorId,
      departmentId,
      queueType,
      visitType,
      referralSource,
      referredBy: optionalText(data.referredBy),
      reason: optionalText(data.reason),
      notes: optionalText(data.notes),
      photoData: data.photoData,
      checkInNow: Boolean(data.checkInNow),
      scheduledAt,
    };
  });

export const appointmentPatchSchema = z
  .object({
    action: z.enum(PATCH_ACTIONS, { error: "Unknown appointment action." }),
    scheduledAt: z.unknown().optional(),
    channels: z.unknown().optional(),
    photoData: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "reschedule") {
      const scheduledAt = new Date(String(data.scheduledAt ?? ""));
      if (Number.isNaN(scheduledAt.getTime())) {
        ctx.addIssue({ code: "custom", message: "Choose a valid appointment time.", path: ["scheduledAt"] });
      }
    }
    if (data.action === "photo" && !text(data.photoData)) {
      ctx.addIssue({ code: "custom", message: "Capture a photo first.", path: ["photoData"] });
    }
    if (data.action === "remind" && data.channels != null) {
      if (!Array.isArray(data.channels)) {
        ctx.addIssue({ code: "custom", message: "Select at least one reminder channel.", path: ["channels"] });
        return;
      }
      const channels = data.channels.map((channel) => String(channel));
      if (channels.length === 0 || channels.some((channel) => !(CHANNELS as readonly string[]).includes(channel))) {
        ctx.addIssue({ code: "custom", message: "Select at least one reminder channel.", path: ["channels"] });
      }
    }
  })
  .transform((data) => ({
    action: data.action,
    scheduledAt: data.scheduledAt,
    channels: data.channels,
    photoData: data.photoData,
  }));
