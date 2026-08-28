import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  BILLING_ROLES,
  amountsMatch,
  doctorName,
  forbidUnless,
  invoiceStatusFromTotals,
  nextInvoiceNo,
  patientName,
  paymentNote,
  requireHospitalActor,
} from "@/lib/front-desk";
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
  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: {
      patient: true,
      doctor: { include: { appUser: { select: { username: true } } } },
      department: true,
      invoices: { orderBy: { issuedAt: "desc" }, take: 1 },
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Visit not found." }, { status: 404 });
  }
  if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    return NextResponse.json({ error: "Payment cannot be recorded for this visit." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const method = String(body?.method ?? "") as PaymentMethod;
  const amount = Number(body?.amount ?? 0);
  if (!METHODS.includes(method) || !(amount > 0)) {
    return NextResponse.json({ error: "Choose cash, card, or UPI and enter a valid amount." }, { status: 400 });
  }

  const cardBrand = String(body?.cardBrand ?? "").trim();
  const cardLast4 = String(body?.cardLast4 ?? "").replace(/\D/g, "").slice(-4);
  const referenceNo = String(body?.referenceNo ?? "").trim();
  if (method === "CARD") {
    if (!CARD_BRANDS.includes(cardBrand)) {
      return NextResponse.json({ error: "Choose a card type (Visa, Mastercard, RuPay, Amex, or Other)." }, { status: 400 });
    }
    if (cardLast4 && cardLast4.length !== 4) {
      return NextResponse.json({ error: "Last 4 digits must be 4 numbers, or leave it blank." }, { status: 400 });
    }
  }

  const notes = paymentNote({
    method,
    cardBrand: method === "CARD" ? cardBrand : null,
    cardLast4: method === "CARD" && cardLast4.length === 4 ? cardLast4 : null,
    referenceNo: method === "CARD" || method === "UPI" ? referenceNo || null : null,
    extra: String(body?.notes ?? "").trim() || null,
  });

  const existing = appointment.invoices[0];
  if (existing && Number(existing.paidAmount) + 0.001 >= Number(existing.netTotal) && Number(existing.netTotal) > 0) {
    return NextResponse.json({ error: "This visit is already paid.", invoiceId: existing.id }, { status: 409 });
  }

  const hospital = scoped.user.hospital ?? (await prisma.hospital.findUnique({ where: { id: scoped.user.hospitalId } }));
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 400 });
  }

  const charge = existing ? Number(existing.netTotal) : amount;
  if (!existing && !(charge > 0)) {
    return NextResponse.json({ error: "Enter the OPD amount." }, { status: 400 });
  }
  const due = existing ? Number(existing.netTotal) - Number(existing.paidAmount) : charge;
  if (!amountsMatch(amount, due)) {
    return NextResponse.json(
      { error: `Check-in requires the full amount of ₹${due.toFixed(2)}. Partial payment is not allowed.` },
      { status: 400 },
    );
  }

  const signature = await activeSignatureFor(scoped.user.id, scoped.user.hospitalId);

  try {
    const result = await prisma.$transaction(async (tx) => {
    const invoice =
      existing ??
      (await tx.invoice.create({
        data: {
          hospitalId: scoped.user.hospitalId,
          invoiceNo: await nextInvoiceNo(scoped.user.hospitalId, hospital.code),
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          status: "ISSUED",
          subtotal: charge,
          discountAmount: 0,
          netTotal: charge,
          items: {
            create: {
              description: `Consultation — ${appointment.department.name} with ${doctorName(appointment.doctor)}`,
              amount: charge,
            },
          },
        },
      }));

    await tx.payment.create({
      data: {
        hospitalId: scoped.user.hospitalId,
        patientId: appointment.patientId,
        invoiceId: invoice.id,
        kind: "COLLECTION",
        method,
        amount,
        notes,
        receivedByUserId: scoped.user.id,
        receivedBySignatureId: signature?.id ?? null,
      },
    });

    const paidAmount = Number(invoice.paidAmount) + amount;
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount,
        status: invoiceStatusFromTotals(Number(invoice.netTotal), paidAmount),
      },
    });

    return updated;
    });

    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "VISIT_PAYMENT_COLLECTED",
      entity: "Invoice",
      entityId: result.id,
      summary: `${scoped.user.username} recorded ${method.toLowerCase()} ${amount} for ${patientName(appointment.patient)} (${doctorName(appointment.doctor)}).`,
    });

    return NextResponse.json({ ok: true, invoice: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record payment.";
    const status = /full amount|Partial payment/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
