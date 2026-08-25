import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { addHospitalSeatsAndInvoice } from "@/lib/platform-billing";
import { prisma } from "@/lib/prisma";
import { isSubscriptionTierId } from "@/lib/subscription-tiers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const hospital = await prisma.hospital.findUnique({ where: { id } });
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const tierId = String(body?.tierId ?? "").trim();
  const paymentMethod = String(body?.paymentMethod ?? "CASH").toUpperCase() as PaymentMethod;
  const notes = body?.notes != null ? String(body.notes).trim() || null : null;

  if (!["CASH", "CARD", "UPI"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Select a valid payment method." }, { status: 400 });
  }
  if (!isSubscriptionTierId(tierId)) {
    return NextResponse.json({ error: "Choose a valid subscription plan." }, { status: 400 });
  }
  if (tierId === hospital.subscriptionTier) {
    return NextResponse.json({ error: "Hospital is already on that plan." }, { status: 400 });
  }

  try {
    const invoice = await addHospitalSeatsAndInvoice({
      hospitalId: hospital.id,
      tierId,
      paymentMethod,
      notes,
    });

    await writeAuditLog({
      request,
      hospitalId: hospital.id,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "SUBSCRIPTION_UPDATED",
      entity: "Hospital",
      entityId: hospital.id,
      summary: `${actor.username} changed plan for ${hospital.code} to ${tierId} — invoice ${invoice.invoiceNo}.`,
      metadata: { tierId, invoiceNo: invoice.invoiceNo },
    });

    return NextResponse.json({ ok: true, invoice });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update subscription." },
      { status: 400 },
    );
  }
}
