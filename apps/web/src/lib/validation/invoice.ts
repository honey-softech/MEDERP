import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/billing/types";

const PATCH_ACTIONS = ["pay", "discount", "waiver-request", "waiver-decide", "refund"] as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

export const sendInvoiceSchema = z.preprocess(
  (raw) => (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
  z
    .object({
      channel: z.unknown().optional(),
    })
    .transform((data, ctx) => {
      const requested = String(data.channel ?? "WHATSAPP").toUpperCase();
      const channel = requested === "SMS" ? "WHATSAPP" : requested;
      if (channel !== "WHATSAPP") {
        ctx.addIssue({ code: "custom", message: "Choose WhatsApp." });
        return z.NEVER;
      }
      return { channel: "WHATSAPP" as const };
    }),
);

export const createInvoiceSchema = z
  .object({
    patientId: z.unknown().optional(),
    appointmentId: z.unknown().optional(),
    discountAmount: z.unknown().optional(),
    description: z.unknown().optional(),
    items: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const patientId = text(data.patientId);
    if (!patientId) {
      ctx.addIssue({ code: "custom", message: "Patient not found." });
      return z.NEVER;
    }
    return {
      patientId,
      appointmentId: text(data.appointmentId) || null,
      discountAmount: Math.max(0, Number(data.discountAmount ?? 0)),
      description: text(data.description),
      items: data.items,
    };
  });

export const invoicePatchSchema = z
  .object({
    action: z.enum(PATCH_ACTIONS, { error: "Unknown invoice action." }),
    method: z.unknown().optional(),
    amount: z.unknown().optional(),
    notes: z.unknown().optional(),
    reason: z.unknown().optional(),
    approve: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "pay" || data.action === "refund") {
      const method = String(data.method ?? (data.action === "refund" ? "CASH" : ""));
      const amount = Number(data.amount ?? 0);
      if (data.action === "pay" && (!(PAYMENT_METHODS as readonly string[]).includes(method) || !(amount > 0))) {
        ctx.addIssue({ code: "custom", message: "Enter a valid payment method and amount." });
      }
      if (data.action === "refund" && (!(PAYMENT_METHODS as readonly string[]).includes(method) || !(amount > 0))) {
        ctx.addIssue({ code: "custom", message: "Enter a valid refund method and amount." });
      }
    }
    if (data.action === "waiver-request") {
      const amount = Math.max(0, Number(data.amount ?? 0));
      const reason = text(data.reason);
      if (!(amount > 0) || !reason) {
        ctx.addIssue({ code: "custom", message: "Waiver amount and reason are required." });
      }
    }
  });
