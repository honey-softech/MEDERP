import { PAYMENT_METHODS, type BillingPaymentMethod } from "@/lib/billing/types";

export function normalizeWhatsAppChannel(raw: unknown): "WHATSAPP" | null {
  const requested = String(raw ?? "WHATSAPP").toUpperCase();
  const channel = requested === "SMS" ? "WHATSAPP" : requested;
  return channel === "WHATSAPP" ? "WHATSAPP" : null;
}

export function billPdfFilename(invoiceNo: string) {
  return `bill-${invoiceNo.replace(/[^\w.-]+/g, "_")}.pdf`;
}

export function invoiceDue(netTotal: { toString(): string } | number, paidAmount: { toString(): string } | number) {
  return Math.max(0, Number(netTotal) - Number(paidAmount));
}

export function canSendIssuedInvoice(status: string) {
  return status !== "VOID" && status !== "DRAFT";
}

export function patientMobileDigits(phone: string | null | undefined) {
  return phone?.replace(/\D/g, "") ?? "";
}

export function hasSendableMobile(phone: string | null | undefined) {
  return patientMobileDigits(phone).length >= 10;
}

export function parseBillItems(raw: unknown): { description: string; amount: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item && typeof item === "object" ? (item as { description?: unknown; amount?: unknown }) : {};
      return {
        description: String(row.description ?? "").trim(),
        amount: Number(row.amount ?? 0),
      };
    })
    .filter((item) => item.description && item.amount > 0);
}

export function validatePayment(input: {
  method: string;
  amount: number;
  due: number;
  requireFull: boolean;
  advanceBalance: number;
}): { ok: true; method: BillingPaymentMethod } | { ok: false; error: string; status: number } {
  const method = input.method as BillingPaymentMethod;
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method) || !(input.amount > 0)) {
    return { ok: false, error: "Enter a valid payment method and amount.", status: 400 };
  }
  if (input.amount > input.due + 0.01) {
    return { ok: false, error: "Amount is more than the balance due.", status: 400 };
  }
  if (input.requireFull && Math.abs(input.amount - input.due) > 0.01) {
    return {
      ok: false,
      error: `Full amount of ₹${input.due.toFixed(2)} is required. Partial payment is not allowed.`,
      status: 400,
    };
  }
  if (method === "ADVANCE" && input.advanceBalance < input.amount) {
    return { ok: false, error: "Patient advance balance is insufficient.", status: 409 };
  }
  return { ok: true, method };
}

export function validateDiscount(input: {
  discountAmount: number;
  subtotal: number;
  waiverAmount: number;
  paidAmount: number;
}): { ok: true; netTotal: number } | { ok: false; error: string; status: number } {
  if (input.discountAmount > input.subtotal) {
    return { ok: false, error: "Discount cannot exceed the subtotal.", status: 400 };
  }
  const netTotal = input.subtotal - input.discountAmount - input.waiverAmount;
  if (netTotal < input.paidAmount) {
    return { ok: false, error: "Discount would put the invoice below amount already paid.", status: 409 };
  }
  return { ok: true, netTotal };
}

export function validateRefund(input: {
  method: string;
  amount: number;
  paidAmount: number;
}): { ok: true; method: BillingPaymentMethod } | { ok: false; error: string; status: number } {
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method) || !(input.amount > 0)) {
    return { ok: false, error: "Enter a valid refund method and amount.", status: 400 };
  }
  if (input.amount > input.paidAmount + 0.01) {
    return { ok: false, error: "Refund cannot exceed amount collected.", status: 400 };
  }
  return { ok: true, method: input.method as BillingPaymentMethod };
}
