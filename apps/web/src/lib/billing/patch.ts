import type { Invoice, Patient } from "@prisma/client";
import type { HospitalActor } from "@/lib/authz/hospital";
import {
  applyInvoiceDiscount,
  collectInvoicePayment,
  decideInvoiceWaiver,
  refundInvoicePayment,
  requestInvoiceWaiver,
} from "@/lib/billing/actions";
import type { BillingActionResult } from "@/lib/billing/types";

type InvoiceWithPatient = Invoice & { patient: Patient };

export async function runInvoicePatch(params: {
  request: Request;
  user: HospitalActor;
  invoice: InvoiceWithPatient;
  body: {
    action: string;
    method?: unknown;
    amount?: unknown;
    notes?: unknown;
    reason?: unknown;
    approve?: unknown;
  };
}): Promise<BillingActionResult> {
  const ctx = { request: params.request, user: params.user, invoice: params.invoice };
  const { action, method, amount, notes, reason, approve } = params.body;

  if (action === "pay") {
    return collectInvoicePayment({
      ...ctx,
      method: String(method ?? ""),
      amount: Number(amount ?? 0),
      notes: String(notes ?? "").trim() || null,
    });
  }
  if (action === "discount") {
    return applyInvoiceDiscount({ ...ctx, amount: Number(amount ?? 0) });
  }
  if (action === "waiver-request") {
    return requestInvoiceWaiver({
      ...ctx,
      amount: Number(amount ?? 0),
      reason: String(reason ?? ""),
    });
  }
  if (action === "waiver-decide") {
    return decideInvoiceWaiver({ ...ctx, approve: Boolean(approve) });
  }
  if (action === "refund") {
    return refundInvoicePayment({
      ...ctx,
      method: String(method ?? "CASH"),
      amount: Number(amount ?? 0),
      notes: String(notes ?? "").trim() || null,
    });
  }
  return { ok: false, error: "Unknown invoice action.", status: 400 };
}
