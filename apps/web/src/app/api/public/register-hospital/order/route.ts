/**
 * Starts Razorpay Checkout for hospital registration.
 * Currently unused while the public register form skips the payment gateway.
 */
import { NextResponse } from "next/server";
import { HospitalRegistrationError, prepareHospitalRegistration } from "@/lib/hospital-registration";
import { trialEndsAtFromNow } from "@/lib/hospital-access";
import {
  createRazorpaySubscription,
  deferredSubscriptionStartAtUnix,
  resolveOrCreatePlan,
  unixToDate,
} from "@/lib/hospital-subscription";
import {
  razorpayConfigured,
  razorpayErrorMessage,
  razorpayKeyId,
  toPaise,
} from "@/lib/razorpay";

export async function POST(request: Request) {
  if (!razorpayConfigured()) {
    return NextResponse.json(
      { error: "Online payment is not configured. Add Razorpay test keys to the server .env file." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.termsAccepted) {
    return NextResponse.json(
      { error: "Accept the Terms & Conditions before starting payment." },
      { status: 400 },
    );
  }

  try {
    const prepared = await prepareHospitalRegistration({
      name: String(body.name ?? ""),
      code: String(body.code ?? ""),
      address: body.address != null ? String(body.address) : null,
      phone: body.phone != null ? String(body.phone) : null,
      adminUsername: String(body.adminUsername ?? ""),
      adminMobile: String(body.adminMobile ?? ""),
      adminEmail: body.adminEmail != null ? String(body.adminEmail) : null,
      adminPassword: String(body.adminPassword ?? ""),
      tierId: body.tierId != null ? String(body.tierId) : undefined,
      extraStaffSlots: Number(body.extraStaffSlots ?? 0),
      pharmacyEnabled: Boolean(body.pharmacyEnabled),
      labEnabled: Boolean(body.labEnabled),
      termsAccepted: true,
      referralCode: body.referralCode != null ? String(body.referralCode) : null,
    });

    const amountPaise = toPaise(prepared.quote.total);
    if (amountPaise < 100) {
      return NextResponse.json({ error: "Payable amount is too small for Razorpay." }, { status: 400 });
    }

    const startAt = deferredSubscriptionStartAtUnix();
    const trialEndsAt = unixToDate(startAt) ?? trialEndsAtFromNow();

    try {
      const plan = await resolveOrCreatePlan({
        hospitalCode: prepared.code,
        amountInr: prepared.quote.total,
        description: `MedERP monthly · ${prepared.code}`,
        tierId: prepared.tierId,
      });
      const subscription = await createRazorpaySubscription({
        planId: plan.id,
        hospitalCode: prepared.code,
        adminUsername: prepared.adminUsername,
        adminEmail: prepared.adminEmail,
        adminMobile: prepared.adminMobile,
        startAt,
      });

      return NextResponse.json({
        amount: amountPaise,
        currency: "INR",
        keyId: razorpayKeyId(),
        quote: {
          total: prepared.quote.total,
          lines: prepared.quote.lines,
        },
        prefill: {
          name: prepared.adminUsername,
          contact: prepared.adminMobile,
          email: prepared.adminEmail,
        },
        hospitalName: prepared.name,
        mode: "subscription",
        subscriptionId: subscription.id,
        planId: plan.id,
        shortUrl: (subscription as { short_url?: string }).short_url ?? null,
        recurring: true,
        deferredBilling: true,
        startAt,
        trialEndsAt: trialEndsAt.toISOString(),
        notice:
          "Add your card now to start the 1-month free trial. The plan amount is charged automatically from next month — nothing is billed today except a small bank authentication hold (if any), which Razorpay refunds.",
      });
    } catch (subscriptionError) {
      console.error("Razorpay deferred subscription for registration failed", subscriptionError);
      const razorpayMessage = razorpayErrorMessage(subscriptionError);
      return NextResponse.json(
        {
          error: razorpayMessage
            ? `Could not start card setup: ${razorpayMessage}`
            : "Could not start card setup. Razorpay Subscriptions must be enabled for trial-then-charge registration.",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    if (error instanceof HospitalRegistrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Razorpay registration payment start failed", error);
    const razorpayMessage = razorpayErrorMessage(error);
    return NextResponse.json(
      {
        error: razorpayMessage
          ? `Could not start online payment: ${razorpayMessage}`
          : "Could not start online payment. Check Razorpay keys in apps/web/.env and restart the server.",
      },
      { status: 500 },
    );
  }
}
