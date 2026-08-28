import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  BILLING_ROLES,
  FRONT_DESK_ROLES,
  WAIVER_APPROVER_ROLES,
  forbidUnless,
  invoiceStatusFromTotals,
  patientName,
  requireHospitalActor,
} from "@/lib/front-desk";
import { syncLabOrderPaymentFromInvoice } from "@/lib/lab";
import { notifyHospitalRole } from "@/lib/notifications";
import { activeSignatureFor } from "@/lib/signatures";

const METHODS: PaymentMethod[] = ["CASH", "CARD", "UPI", "INSURANCE", "ADVANCE"];

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;
  const { id } = await context.params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: {
      patient: true,
      items: true,
      payments: true,
      appointment: { include: { doctor: { include: { appUser: { select: { username: true } } } }, department: true } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  return NextResponse.json({ invoice });
}

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id } = await context.params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: { patient: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const actor = scoped.user;

  if (action === "pay") {
    const denied = forbidUnless(actor.role, BILLING_ROLES);
    if (denied) return denied;
    const method = String(body?.method ?? "") as PaymentMethod;
    const amount = Number(body?.amount ?? 0);
    const notes = String(body?.notes ?? "").trim() || null;
    if (!METHODS.includes(method) || !(amount > 0)) {
      return NextResponse.json({ error: "Enter a valid payment method and amount." }, { status: 400 });
    }
    const due = Number(invoice.netTotal) - Number(invoice.paidAmount);
    if (amount > due + 0.01) {
      return NextResponse.json({ error: "Amount is more than the balance due." }, { status: 400 });
    }
    const labLinked = await prisma.labOrder.count({ where: { invoiceId: invoice.id } });
    if ((invoice.appointmentId || labLinked > 0) && Math.abs(amount - due) > 0.01) {
      return NextResponse.json(
        { error: `Full amount of ₹${due.toFixed(2)} is required. Partial payment is not allowed.` },
        { status: 400 },
      );
    }
    if (method === "ADVANCE") {
      if (Number(invoice.patient.advanceBalance) < amount) {
        return NextResponse.json({ error: "Patient advance balance is insufficient." }, { status: 409 });
      }
    }

    const paidAmount = Number(invoice.paidAmount) + amount;
    const signature = await activeSignatureFor(actor.id, actor.hospitalId);
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          hospitalId: actor.hospitalId,
          patientId: invoice.patientId,
          invoiceId: invoice.id,
          kind: "COLLECTION",
          method,
          amount,
          notes,
          receivedByUserId: actor.id,
          receivedBySignatureId: signature?.id ?? null,
        },
      });
      if (method === "ADVANCE") {
        await tx.patient.update({
          where: { id: invoice.patientId },
          data: { advanceBalance: { decrement: amount } },
        });
      }
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount,
          status: invoiceStatusFromTotals(Number(invoice.netTotal), paidAmount),
        },
      });
    });

    await writeAuditLog({
      request,
      hospitalId: actor.hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "PAYMENT_COLLECTED",
      entity: "Invoice",
      entityId: invoice.id,
      summary: `${actor.username} collected ${method.toLowerCase()} ${amount} on ${invoice.invoiceNo} for ${patientName(invoice.patient)}.`,
    });
    await syncLabOrderPaymentFromInvoice(invoice.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "discount") {
    const denied = forbidUnless(actor.role, BILLING_ROLES);
    if (denied) return denied;
    const discountAmount = Math.max(0, Number(body?.amount ?? 0));
    if (discountAmount > Number(invoice.subtotal)) {
      return NextResponse.json({ error: "Discount cannot exceed the subtotal." }, { status: 400 });
    }
    const waiver = invoice.waiverStatus === "APPROVED" ? Number(invoice.waiverAmount) : 0;
    const netTotal = Number(invoice.subtotal) - discountAmount - waiver;
    if (netTotal < Number(invoice.paidAmount)) {
      return NextResponse.json({ error: "Discount would put the invoice below amount already paid." }, { status: 409 });
    }
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        discountAmount,
        netTotal,
        status: invoiceStatusFromTotals(netTotal, Number(invoice.paidAmount)),
      },
    });
    await writeAuditLog({
      request,
      hospitalId: actor.hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "INVOICE_DISCOUNT",
      entity: "Invoice",
      entityId: invoice.id,
      summary: `${actor.username} applied discount ${discountAmount} on ${invoice.invoiceNo}.`,
    });
    await syncLabOrderPaymentFromInvoice(invoice.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "waiver-request") {
    const denied = forbidUnless(actor.role, FRONT_DESK_ROLES);
    if (denied) return denied;
    const waiverAmount = Math.max(0, Number(body?.amount ?? 0));
    const waiverReason = String(body?.reason ?? "").trim();
    if (!(waiverAmount > 0) || !waiverReason) {
      return NextResponse.json({ error: "Waiver amount and reason are required." }, { status: 400 });
    }
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { waiverAmount, waiverReason, waiverStatus: "PENDING" },
    });
    const labOrder = await prisma.labOrder.findFirst({ where: { invoiceId: invoice.id }, select: { id: true } });
    const href = labOrder ? `/billing/lab/${labOrder.id}` : `/billing/${invoice.id}`;
    await Promise.all([
      notifyHospitalRole({
        hospitalId: actor.hospitalId,
        role: "ACCOUNTANT",
        href,
        title: "Waiver needs approval",
        body: `${actor.username} requested a waiver of ₹${waiverAmount.toFixed(2)} on ${invoice.invoiceNo} for ${patientName(invoice.patient)}.`,
      }),
      notifyHospitalRole({
        hospitalId: actor.hospitalId,
        role: "SUPER_ADMIN",
        href,
        title: "Waiver needs approval",
        body: `${actor.username} requested a waiver of ₹${waiverAmount.toFixed(2)} on ${invoice.invoiceNo} for ${patientName(invoice.patient)}.`,
      }),
    ]);
    await writeAuditLog({
      request,
      hospitalId: actor.hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "WAIVER_REQUESTED",
      entity: "Invoice",
      entityId: invoice.id,
      summary: `${actor.username} requested waiver ${waiverAmount} on ${invoice.invoiceNo}.`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "waiver-decide") {
    const denied = forbidUnless(actor.role, WAIVER_APPROVER_ROLES);
    if (denied) return denied;
    if (invoice.waiverStatus !== "PENDING") {
      return NextResponse.json({ error: "No pending waiver to decide." }, { status: 409 });
    }
    const approve = Boolean(body?.approve);
    const waiver = approve ? Number(invoice.waiverAmount) : 0;
    const netTotal = Number(invoice.subtotal) - Number(invoice.discountAmount) - waiver;
    if (approve && netTotal < Number(invoice.paidAmount)) {
      return NextResponse.json({ error: "Approved waiver would put the invoice below amount already paid." }, { status: 409 });
    }
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        waiverStatus: approve ? "APPROVED" : "REJECTED",
        waiverAmount: approve ? invoice.waiverAmount : 0,
        netTotal: approve ? netTotal : Number(invoice.subtotal) - Number(invoice.discountAmount),
        status: invoiceStatusFromTotals(
          approve ? netTotal : Number(invoice.subtotal) - Number(invoice.discountAmount),
          Number(invoice.paidAmount),
        ),
      },
    });
    await writeAuditLog({
      request,
      hospitalId: actor.hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: approve ? "WAIVER_APPROVED" : "WAIVER_REJECTED",
      entity: "Invoice",
      entityId: invoice.id,
      summary: `${actor.username} ${approve ? "approved" : "rejected"} waiver on ${invoice.invoiceNo}.`,
    });
    await syncLabOrderPaymentFromInvoice(invoice.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "refund") {
    const denied = forbidUnless(actor.role, BILLING_ROLES);
    if (denied) return denied;
    const method = String(body?.method ?? "CASH") as PaymentMethod;
    const amount = Number(body?.amount ?? 0);
    const notes = String(body?.notes ?? "").trim() || null;
    if (!METHODS.includes(method) || !(amount > 0)) {
      return NextResponse.json({ error: "Enter a valid refund method and amount." }, { status: 400 });
    }
    if (amount > Number(invoice.paidAmount) + 0.01) {
      return NextResponse.json({ error: "Refund cannot exceed amount collected." }, { status: 400 });
    }
    const paidAmount = Number(invoice.paidAmount) - amount;
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          hospitalId: actor.hospitalId,
          patientId: invoice.patientId,
          invoiceId: invoice.id,
          kind: "REFUND",
          method,
          amount,
          notes,
          receivedByUserId: actor.id,
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount,
          status: invoiceStatusFromTotals(Number(invoice.netTotal), paidAmount),
        },
      }),
    ]);
    await writeAuditLog({
      request,
      hospitalId: actor.hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "PAYMENT_REFUNDED",
      entity: "Invoice",
      entityId: invoice.id,
      summary: `${actor.username} refunded ${amount} on ${invoice.invoiceNo} for ${patientName(invoice.patient)}.`,
    });
    await syncLabOrderPaymentFromInvoice(invoice.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown invoice action." }, { status: 400 });
}
