import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  createRazorpaySubscription,
  monthlyAmountForSelection,
  recordSubscriptionCharge,
  resolveOrCreatePlan,
  upsertHospitalSubscription,
  unixToDate,
} from "@/lib/hospital-subscription";
import {
  getRazorpayClient,
  razorpayConfigured,
  razorpayErrorMessage,
  razorpayKeyId,
  toPaise,
  verifyRazorpaySubscriptionSignature,
} from "@/lib/razorpay";
import { hospitalFieldsFromTier, isSubscriptionTierId, requireSubscriptionTier } from "@/lib/subscription-tiers";

function resolveTierId(body: Record<string, unknown> | null, hospitalTier: string) {
  const fromBody = String(body?.tierId ?? "").trim();
  if (fromBody && isSubscriptionTierId(fromBody)) return fromBody;
  if (isSubscriptionTierId(hospitalTier)) return hospitalTier;
  return "CLINIC";
}

/** Start Razorpay Checkout for an existing hospital that has no auto-debit yet. */
export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SUPER_ADMIN" || !actor.hospitalId) {
    return NextResponse.json({ error: "Hospital super admin access required." }, { status: 403 });
  }
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.termsAccepted) {
    return NextResponse.json({ error: "Accept the Terms & Conditions first." }, { status: 400 });
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: actor.hospitalId },
    include: { subscription: true },
  });
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  }
  if (hospital.subscription && !["CANCELLED", "COMPLETED", "EXPIRED"].includes(hospital.subscription.status)) {
    return NextResponse.json({ error: "A Razorpay subscription is already linked." }, { status: 409 });
  }

  const phase = String(body?.phase ?? "create");
  const tierId = resolveTierId(body, hospital.subscriptionTier);

  try {
    if (phase === "create") {
      const quote = await monthlyAmountForSelection({ tierId });
      const plan = await resolveOrCreatePlan({
        hospitalCode: hospital.code,
        amountInr: quote.total,
        description: `MedERP monthly · ${hospital.code} · ${quote.tier.name}`,
      });
      const subscription = await createRazorpaySubscription({
        planId: plan.id,
        hospitalCode: hospital.code,
        adminUsername: actor.username,
        adminEmail: actor.email ?? undefined,
        adminMobile: actor.mobile,
      });
      return NextResponse.json({
        subscriptionId: subscription.id,
        planId: plan.id,
        shortUrl: (subscription as { short_url?: string }).short_url ?? null,
        amount: toPaise(quote.total),
        currency: "INR",
        keyId: razorpayKeyId(),
        quote: { total: quote.total, lines: quote.lines },
        prefill: {
          name: actor.username,
          contact: actor.mobile,
          email: actor.email ?? undefined,
        },
      });
    }

    const razorpaySubscriptionId = String(body?.razorpay_subscription_id ?? "").trim();
    const razorpayPaymentId = String(body?.razorpay_payment_id ?? "").trim();
    const razorpaySignature = String(body?.razorpay_signature ?? "").trim();
    const planId = String(body?.planId ?? "").trim();
    if (!razorpaySubscriptionId || !razorpayPaymentId || !razorpaySignature || !planId) {
      return NextResponse.json({ error: "Complete Razorpay payment first." }, { status: 400 });
    }
    if (
      !verifyRazorpaySubscriptionSignature({
        paymentId: razorpayPaymentId,
        subscriptionId: razorpaySubscriptionId,
        signature: razorpaySignature,
      })
    ) {
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }

    const quote = await monthlyAmountForSelection({ tierId });
    const razorpay = getRazorpayClient();
    const remote = await razorpay.subscriptions.fetch(razorpaySubscriptionId);
    const payment = await razorpay.payments.fetch(razorpayPaymentId);
    if (Number(payment.amount) !== toPaise(quote.total)) {
      return NextResponse.json({ error: "Paid amount does not match the monthly package." }, { status: 400 });
    }

    const tier = requireSubscriptionTier(tierId);
    await prisma.hospital.update({
      where: { id: hospital.id },
      data: hospitalFieldsFromTier(tier),
    });

    const subscription = await upsertHospitalSubscription({
      hospitalId: hospital.id,
      razorpayPlanId: planId,
      razorpaySubscriptionId,
      monthlyAmount: quote.total,
      status: "ACTIVE",
      termsAcceptedAt: new Date(),
      currentPeriodStart: unixToDate(remote.current_start),
      currentPeriodEnd: unixToDate(remote.current_end),
      nextChargeAt: unixToDate(remote.charge_at),
    });

    await recordSubscriptionCharge({
      hospitalId: hospital.id,
      amountInr: quote.total,
      razorpayPaymentId,
      razorpaySubscriptionId,
      notes: `Razorpay subscription linked · ${razorpaySubscriptionId}`,
      lines: quote.lines,
    });

    await writeAuditLog({
      request,
      hospitalId: hospital.id,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "SUBSCRIPTION_STARTED",
      entity: "HospitalSubscription",
      entityId: subscription.id,
      summary: `${actor.username} linked Razorpay monthly auto-debit for ${hospital.code} (₹${quote.total}/month).`,
      metadata: {
        razorpaySubscriptionId,
        razorpayPaymentId,
        paymentMethod: "UPI" as PaymentMethod,
        tierId,
      },
    });

    return NextResponse.json({ ok: true, subscription, monthlyAmount: quote.total });
  } catch (error) {
    console.error("Start hospital subscription failed", error);
    return NextResponse.json(
      {
        error:
          razorpayErrorMessage(error) ||
          (error instanceof Error ? error.message : "Could not start subscription."),
      },
      { status: 400 },
    );
  }
}
