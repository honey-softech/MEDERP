import type { Invoice, Patient } from "@prisma/client";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import {
  BILLING_ROLES,
  FRONT_DESK_ROLES,
  WAIVER_APPROVER_ROLES,
  type HospitalActor,
} from "@/lib/authz/hospital";
import { invoiceDue, validateDiscount, validatePayment, validateRefund } from "@/lib/billing/rules";
import type { BillingActionResult } from "@/lib/billing/types";
import { patientName } from "@/lib/display";
import { invoiceStatusFromTotals } from "@/lib/opd/fees";
import { syncLabOrderPaymentFromInvoice } from "@/lib/lab";
import { notifyHospitalRole } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { activeSignatureFor } from "@/lib/signatures";

type InvoiceWithPatient = Invoice & { patient: Patient };

function noAccess(): BillingActionResult {
  return { ok: false, error: "You do not have access to this action.", status: 403 };
}

export async function collectInvoicePayment(params: {
  request: Request;
  user: HospitalActor;
  invoice: InvoiceWithPatient;
  method: string;
  amount: number;
  notes: string | null;
}): Promise<BillingActionResult> {
  if (!BILLING_ROLES.includes(params.user.role)) return noAccess();
  const due = invoiceDue(params.invoice.netTotal, params.invoice.paidAmount);
  const labLinked = await prisma.labOrder.count({ where: { invoiceId: params.invoice.id } });
  const requireFull = Boolean(params.invoice.appointmentId || labLinked > 0);
  const valid = validatePayment({
    method: params.method,
    amount: params.amount,
    due,
    requireFull,
    advanceBalance: Number(params.invoice.patient.advanceBalance),
  });
  if (!valid.ok) return valid;

  const paidAmount = Number(params.invoice.paidAmount) + params.amount;
  const signature = await activeSignatureFor(params.user.id, params.user.hospitalId);
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        hospitalId: params.user.hospitalId,
        patientId: params.invoice.patientId,
        invoiceId: params.invoice.id,
        kind: "COLLECTION",
        method: valid.method,
        amount: params.amount,
        notes: params.notes,
        receivedByUserId: params.user.id,
        receivedBySignatureId: signature?.id ?? null,
      },
    });
    if (valid.method === "ADVANCE") {
      await tx.patient.update({
        where: { id: params.invoice.patientId },
        data: { advanceBalance: { decrement: params.amount } },
      });
    }
    await tx.invoice.update({
      where: { id: params.invoice.id },
      data: {
        paidAmount,
        status: invoiceStatusFromTotals(Number(params.invoice.netTotal), paidAmount),
      },
    });
  });

  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: "PAYMENT_COLLECTED",
    entity: "Invoice",
    entityId: params.invoice.id,
    summary: `${params.user.username} collected ${valid.method.toLowerCase()} ${params.amount} on ${params.invoice.invoiceNo} for ${patientName(params.invoice.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { paidAmount: params.invoice.paidAmount, status: params.invoice.status },
        { paidAmount, status: invoiceStatusFromTotals(Number(params.invoice.netTotal), paidAmount) },
        { fields: ["paidAmount", "status"] },
      ),
    },
  });
  await syncLabOrderPaymentFromInvoice(params.invoice.id);
  return { ok: true, body: { ok: true } };
}

export async function applyInvoiceDiscount(params: {
  request: Request;
  user: HospitalActor;
  invoice: InvoiceWithPatient;
  amount: number;
}): Promise<BillingActionResult> {
  if (!BILLING_ROLES.includes(params.user.role)) return noAccess();
  const discountAmount = Math.max(0, params.amount);
  const waiver = params.invoice.waiverStatus === "APPROVED" ? Number(params.invoice.waiverAmount) : 0;
  const valid = validateDiscount({
    discountAmount,
    subtotal: Number(params.invoice.subtotal),
    waiverAmount: waiver,
    paidAmount: Number(params.invoice.paidAmount),
  });
  if (!valid.ok) return valid;

  await prisma.invoice.update({
    where: { id: params.invoice.id },
    data: {
      discountAmount,
      netTotal: valid.netTotal,
      status: invoiceStatusFromTotals(valid.netTotal, Number(params.invoice.paidAmount)),
    },
  });
  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: "INVOICE_DISCOUNT",
    entity: "Invoice",
    entityId: params.invoice.id,
    summary: `${params.user.username} applied discount ${discountAmount} on ${params.invoice.invoiceNo}.`,
    metadata: {
      changes: diffAuditFields(
        {
          discountAmount: params.invoice.discountAmount,
          netTotal: params.invoice.netTotal,
          status: params.invoice.status,
        },
        {
          discountAmount,
          netTotal: valid.netTotal,
          status: invoiceStatusFromTotals(valid.netTotal, Number(params.invoice.paidAmount)),
        },
        { fields: ["discountAmount", "netTotal", "status"] },
      ),
    },
  });
  await syncLabOrderPaymentFromInvoice(params.invoice.id);
  return { ok: true, body: { ok: true } };
}

export async function requestInvoiceWaiver(params: {
  request: Request;
  user: HospitalActor;
  invoice: InvoiceWithPatient;
  amount: number;
  reason: string;
}): Promise<BillingActionResult> {
  if (!FRONT_DESK_ROLES.includes(params.user.role)) return noAccess();
  const waiverAmount = Math.max(0, params.amount);
  const waiverReason = params.reason.trim();
  if (!(waiverAmount > 0) || !waiverReason) {
    return { ok: false, error: "Waiver amount and reason are required.", status: 400 };
  }
  await prisma.invoice.update({
    where: { id: params.invoice.id },
    data: { waiverAmount, waiverReason, waiverStatus: "PENDING" },
  });
  const labOrder = await prisma.labOrder.findFirst({
    where: { invoiceId: params.invoice.id },
    select: { id: true },
  });
  const href = labOrder ? `/billing/lab/${labOrder.id}` : `/billing/${params.invoice.id}`;
  await Promise.all([
    notifyHospitalRole({
      hospitalId: params.user.hospitalId,
      role: "ACCOUNTANT",
      href,
      title: "Waiver needs approval",
      body: `${params.user.username} requested a waiver of ₹${waiverAmount.toFixed(2)} on ${params.invoice.invoiceNo} for ${patientName(params.invoice.patient)}.`,
    }),
    notifyHospitalRole({
      hospitalId: params.user.hospitalId,
      role: "SUPER_ADMIN",
      href,
      title: "Waiver needs approval",
      body: `${params.user.username} requested a waiver of ₹${waiverAmount.toFixed(2)} on ${params.invoice.invoiceNo} for ${patientName(params.invoice.patient)}.`,
    }),
  ]);
  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: "WAIVER_REQUESTED",
    entity: "Invoice",
    entityId: params.invoice.id,
    summary: `${params.user.username} requested waiver ${waiverAmount} on ${params.invoice.invoiceNo}.`,
    metadata: {
      changes: diffAuditFields(
        {
          waiverAmount: params.invoice.waiverAmount,
          waiverReason: params.invoice.waiverReason,
          waiverStatus: params.invoice.waiverStatus,
        },
        { waiverAmount, waiverReason, waiverStatus: "PENDING" },
        { fields: ["waiverAmount", "waiverReason", "waiverStatus"] },
      ),
    },
  });
  return { ok: true, body: { ok: true } };
}

export async function decideInvoiceWaiver(params: {
  request: Request;
  user: HospitalActor;
  invoice: InvoiceWithPatient;
  approve: boolean;
}): Promise<BillingActionResult> {
  if (!WAIVER_APPROVER_ROLES.includes(params.user.role)) return noAccess();
  if (params.invoice.waiverStatus !== "PENDING") {
    return { ok: false, error: "No pending waiver to decide.", status: 409 };
  }
  const waiver = params.approve ? Number(params.invoice.waiverAmount) : 0;
  const netTotal = Number(params.invoice.subtotal) - Number(params.invoice.discountAmount) - waiver;
  if (params.approve && netTotal < Number(params.invoice.paidAmount)) {
    return {
      ok: false,
      error: "Approved waiver would put the invoice below amount already paid.",
      status: 409,
    };
  }
  const nextNet = params.approve ? netTotal : Number(params.invoice.subtotal) - Number(params.invoice.discountAmount);
  const nextStatus = invoiceStatusFromTotals(nextNet, Number(params.invoice.paidAmount));
  await prisma.invoice.update({
    where: { id: params.invoice.id },
    data: {
      waiverStatus: params.approve ? "APPROVED" : "REJECTED",
      waiverAmount: params.approve ? params.invoice.waiverAmount : 0,
      netTotal: nextNet,
      status: nextStatus,
    },
  });
  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: params.approve ? "WAIVER_APPROVED" : "WAIVER_REJECTED",
    entity: "Invoice",
    entityId: params.invoice.id,
    summary: `${params.user.username} ${params.approve ? "approved" : "rejected"} waiver on ${params.invoice.invoiceNo}.`,
    metadata: {
      changes: diffAuditFields(
        {
          waiverStatus: params.invoice.waiverStatus,
          waiverAmount: params.invoice.waiverAmount,
          netTotal: params.invoice.netTotal,
          status: params.invoice.status,
        },
        {
          waiverStatus: params.approve ? "APPROVED" : "REJECTED",
          waiverAmount: params.approve ? params.invoice.waiverAmount : 0,
          netTotal: nextNet,
          status: nextStatus,
        },
        { fields: ["waiverStatus", "waiverAmount", "netTotal", "status"] },
      ),
    },
  });
  await syncLabOrderPaymentFromInvoice(params.invoice.id);
  return { ok: true, body: { ok: true } };
}

export async function refundInvoicePayment(params: {
  request: Request;
  user: HospitalActor;
  invoice: InvoiceWithPatient;
  method: string;
  amount: number;
  notes: string | null;
}): Promise<BillingActionResult> {
  if (!BILLING_ROLES.includes(params.user.role)) return noAccess();
  const valid = validateRefund({
    method: params.method,
    amount: params.amount,
    paidAmount: Number(params.invoice.paidAmount),
  });
  if (!valid.ok) return valid;

  const paidAmount = Number(params.invoice.paidAmount) - params.amount;
  await prisma.$transaction([
    prisma.payment.create({
      data: {
        hospitalId: params.user.hospitalId,
        patientId: params.invoice.patientId,
        invoiceId: params.invoice.id,
        kind: "REFUND",
        method: valid.method,
        amount: params.amount,
        notes: params.notes,
        receivedByUserId: params.user.id,
      },
    }),
    prisma.invoice.update({
      where: { id: params.invoice.id },
      data: {
        paidAmount,
        status: invoiceStatusFromTotals(Number(params.invoice.netTotal), paidAmount),
      },
    }),
  ]);
  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: "PAYMENT_REFUNDED",
    entity: "Invoice",
    entityId: params.invoice.id,
    summary: `${params.user.username} refunded ${params.amount} on ${params.invoice.invoiceNo} for ${patientName(params.invoice.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { paidAmount: params.invoice.paidAmount, status: params.invoice.status },
        { paidAmount, status: invoiceStatusFromTotals(Number(params.invoice.netTotal), paidAmount) },
        { fields: ["paidAmount", "status"] },
      ),
    },
  });
  await syncLabOrderPaymentFromInvoice(params.invoice.id);
  return { ok: true, body: { ok: true } };
}
