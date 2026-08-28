import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  BILLING_ROLES,
  forbidUnless,
  invoiceStatusFromTotals,
  patientName,
  paymentNote,
  requireHospitalActor,
} from "@/lib/front-desk";
import { ensureLabInvoice, syncLabOrderPaymentFromInvoice } from "@/lib/lab";
import { activeSignatureFor } from "@/lib/signatures";

const METHODS: PaymentMethod[] = ["CASH", "CARD", "UPI"];
const CARD_BRANDS = ["Visa", "Mastercard", "RuPay", "Amex", "Other"];

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;

  const { id } = await context.params;
  const order = await prisma.labOrder.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: { patient: true, items: true, invoice: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Lab order not found." }, { status: 404 });
  }
  if (order.fulfillment === "EXTERNAL") {
    return NextResponse.json({ error: "This investigation is done outside. Attach the report on the visit instead of collecting here." }, { status: 409 });
  }
  if (order.status !== "AWAITING_PAYMENT") {
    return NextResponse.json({ error: "This lab order is already collected or closed." }, { status: 409 });
  }
  if (order.items.length === 0) {
    return NextResponse.json({ error: "No tests on this order." }, { status: 400 });
  }

  const hospital = scoped.user.hospital ?? (await prisma.hospital.findUnique({ where: { id: scoped.user.hospitalId } }));
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 400 });
  }

  const invoice =
    order.invoice ??
    (await ensureLabInvoice({
      orderId: order.id,
      hospitalId: scoped.user.hospitalId,
      hospitalCode: hospital.code,
    }));
  if (!invoice) {
    return NextResponse.json({ error: "Could not prepare the lab invoice." }, { status: 400 });
  }

  const due = Math.max(0, Number(invoice.netTotal) - Number(invoice.paidAmount));
  const body = await request.json().catch(() => null);
  const method = String(body?.method ?? "CASH") as PaymentMethod;
  const amount = Number(body?.amount ?? due);

  if (due > 0.05) {
    if (!METHODS.includes(method) || !(amount > 0)) {
      return NextResponse.json({ error: "Choose cash, card, or UPI and enter a valid amount." }, { status: 400 });
    }
    if (Math.abs(amount - due) > 0.05) {
      return NextResponse.json(
        { error: `Collect the full lab amount of ₹${due.toFixed(2)} after discount or waiver.` },
        { status: 400 },
      );
    }
    const cardBrand = String(body?.cardBrand ?? "").trim();
    const cardLast4 = String(body?.cardLast4 ?? "").replace(/\D/g, "").slice(-4);
    const referenceNo = String(body?.referenceNo ?? "").trim();
    if (method === "CARD" && !CARD_BRANDS.includes(cardBrand)) {
      return NextResponse.json({ error: "Choose a card type." }, { status: 400 });
    }

    const notes = paymentNote({
      method,
      cardBrand: method === "CARD" ? cardBrand : null,
      cardLast4: method === "CARD" && cardLast4.length === 4 ? cardLast4 : null,
      referenceNo: method === "CARD" || method === "UPI" ? referenceNo || null : null,
      extra: `Lab tests · ${order.items.map((item) => item.nameSnapshot).join(", ")}`,
    });
    const paidAmount = Number(invoice.paidAmount) + amount;
    const signature = await activeSignatureFor(scoped.user.id, scoped.user.hospitalId);
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          hospitalId: scoped.user.hospitalId,
          patientId: order.patientId,
          invoiceId: invoice.id,
          kind: "COLLECTION",
          method,
          amount,
          notes,
          receivedByUserId: scoped.user.id,
          receivedBySignatureId: signature?.id ?? null,
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
  } else {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: invoiceStatusFromTotals(Number(invoice.netTotal), Number(invoice.paidAmount)) },
    });
  }

  await syncLabOrderPaymentFromInvoice(invoice.id);

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "LAB_PAYMENT_COLLECTED",
    entity: "LabOrder",
    entityId: order.id,
    summary: `${scoped.user.username} collected lab payment ${invoice.invoiceNo} for ${patientName(order.patient)}.`,
  });

  return NextResponse.json({ ok: true, invoice: { id: invoice.id }, orderId: order.id });
}
