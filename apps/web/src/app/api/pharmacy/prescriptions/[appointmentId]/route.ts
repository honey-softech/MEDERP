import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import {
  collectAndDispenseRx,
  getPharmacyRxForAppointment,
  PHARMACY_BILLING_ROLES,
  updateRxLineQuantities,
} from "@/lib/pharmacy-rx";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";

type Ctx = { params: Promise<{ appointmentId: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, PHARMACY_BILLING_ROLES);
  if (denied) return denied;

  const { appointmentId } = await context.params;
  const order = await getPharmacyRxForAppointment(scoped.user.hospitalId, appointmentId);
  if (!order) {
    return NextResponse.json({ error: "No pharmacy order for this visit." }, { status: 404 });
  }
  return NextResponse.json({ order });
}

export async function POST(request: NextRequest, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, PHARMACY_BILLING_ROLES);
  if (denied) return denied;

  const { appointmentId } = await context.params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "collect");

  const order = await prisma.pharmacyRxOrder.findFirst({
    where: { hospitalId: scoped.user.hospitalId, appointmentId },
  });
  if (!order) {
    return NextResponse.json({ error: "No pharmacy order for this visit." }, { status: 404 });
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: scoped.user.hospitalId },
    select: { code: true },
  });
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  }

  try {
    if (action === "update-qty") {
      const updates = Array.isArray(body?.lines) ? body.lines : [];
      const refreshed = await updateRxLineQuantities(
        order.id,
        scoped.user.hospitalId,
        updates.map((line: { lineId: unknown; quantity: unknown }) => ({
          lineId: String(line.lineId),
          quantity: Number(line.quantity),
        })),
      );
      return NextResponse.json({ ok: true, order: refreshed });
    }

    const method = String(body?.method ?? "CASH").toUpperCase() as PaymentMethod;
    if (!["CASH", "CARD", "UPI", "INSURANCE", "ADVANCE"].includes(method)) {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
    }

    const result = await collectAndDispenseRx({
      orderId: order.id,
      hospitalId: scoped.user.hospitalId,
      hospitalCode: hospital.code,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      method,
      notes: body?.notes != null ? String(body.notes) : null,
    });

    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "PHARMACY_RX_DISPENSED",
      entity: "PharmacyRxOrder",
      entityId: order.id,
      summary: `${scoped.user.username} collected pharmacy bill and dispensed stock for visit ${appointmentId}.`,
    });

    return NextResponse.json({ ok: true, order: result, invoiceId: result.invoiceId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not complete pharmacy billing." },
      { status: 400 },
    );
  }
}
