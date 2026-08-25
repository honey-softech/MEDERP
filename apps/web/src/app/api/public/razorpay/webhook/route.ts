import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  applyPendingEntitlements,
  mapRazorpaySubscriptionStatus,
  recordSubscriptionCharge,
  syncSubscriptionPeriod,
  unixToDate,
} from "@/lib/hospital-subscription";
import { fromPaise, verifyRazorpayWebhookSignature } from "@/lib/razorpay";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (process.env.RAZORPAY_WEBHOOK_SECRET?.trim()) {
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }
  } else {
    console.warn("RAZORPAY_WEBHOOK_SECRET is not set; accepting webhook without signature verification.");
  }

  const payload = JSON.parse(rawBody) as {
    event?: string;
    payload?: {
      subscription?: { entity?: Record<string, unknown> };
      payment?: { entity?: Record<string, unknown> };
    };
  };

  const event = String(payload.event ?? "");
  const subscriptionEntity = payload.payload?.subscription?.entity;
  const paymentEntity = payload.payload?.payment?.entity;
  const subscriptionId = String(subscriptionEntity?.id ?? "");

  if (!subscriptionId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const local = await prisma.hospitalSubscription.findUnique({
    where: { razorpaySubscriptionId: subscriptionId },
    include: { hospital: true },
  });
  if (!local) {
    return NextResponse.json({ ok: true, ignored: "unknown_subscription" });
  }

  if (subscriptionEntity) {
    await syncSubscriptionPeriod(local, {
      status: subscriptionEntity.status != null ? String(subscriptionEntity.status) : undefined,
      current_start: subscriptionEntity.current_start as number | null | undefined,
      current_end: subscriptionEntity.current_end as number | null | undefined,
      charge_at: subscriptionEntity.charge_at as number | null | undefined,
      plan_id: subscriptionEntity.plan_id != null ? String(subscriptionEntity.plan_id) : undefined,
    });
  }

  if (event === "subscription.charged" && paymentEntity) {
    const paymentId = String(paymentEntity.id ?? "");
    const amountInr = fromPaise(Number(paymentEntity.amount ?? 0));
    const planId = subscriptionEntity?.plan_id != null ? String(subscriptionEntity.plan_id) : local.razorpayPlanId;

    if (
      local.pendingPlanId &&
      (planId === local.pendingPlanId ||
        (local.pendingMonthlyAmount != null && Math.abs(Number(local.pendingMonthlyAmount) - amountInr) < 0.01))
    ) {
      await applyPendingEntitlements(local.id);
    }

    const invoice = await recordSubscriptionCharge({
      hospitalId: local.hospitalId,
      amountInr,
      razorpayPaymentId: paymentId || null,
      razorpaySubscriptionId: subscriptionId,
      notes: `Razorpay subscription.charged · ${subscriptionId}`,
      lines: [{ description: `MedERP monthly subscription (${local.hospital.code})`, amount: amountInr }],
    });

    await writeAuditLog({
      hospitalId: local.hospitalId,
      actorUsername: "razorpay-webhook",
      actorRole: "SOFTWARE_ADMIN",
      action: "SUBSCRIPTION_CHARGED",
      entity: "PlatformInvoice",
      entityId: invoice.id,
      summary: `Razorpay charged ${amountInr} for ${local.hospital.code} (${invoice.invoiceNo}).`,
      metadata: { subscriptionId, paymentId, event },
    });
  }

  if (event === "subscription.cancelled" || event === "subscription.completed") {
    await prisma.hospitalSubscription.update({
      where: { id: local.id },
      data: {
        status: mapRazorpaySubscriptionStatus(String(subscriptionEntity?.status ?? "cancelled")),
        cancelledAt: new Date(),
        cancelAtPeriodEnd: false,
        nextChargeAt: null,
        currentPeriodEnd: unixToDate(subscriptionEntity?.current_end as number | null | undefined),
      },
    });
  }

  if (event === "subscription.halted" || event === "subscription.pending") {
    await prisma.hospitalSubscription.update({
      where: { id: local.id },
      data: { status: mapRazorpaySubscriptionStatus(String(subscriptionEntity?.status ?? event.split(".")[1])) },
    });
  }

  return NextResponse.json({ ok: true });
}
