/**
 * Paid Razorpay registration. Currently unused from the public register form
 * (payment gateway is paused; the form posts to /api/public/register-hospital/trial).
 * Keep this route so card setup can be restored without rewriting verification.
 */
import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { createSession, homeForRole } from "@/lib/auth";
import { trialEndsAtFromNow } from "@/lib/hospital-access";
import {
  HospitalRegistrationError,
  prepareHospitalRegistration,
  registerHospital,
  doctorProfileFromBody,
} from "@/lib/hospital-registration";
import { mapRazorpaySubscriptionStatus, unixToDate } from "@/lib/hospital-subscription";
import {
  getRazorpayClient,
  razorpayConfigured,
  toPaise,
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionSignature,
} from "@/lib/razorpay";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const mode = String(body.mode ?? "").trim() || (body.razorpay_subscription_id ? "subscription" : "order");
  const razorpaySubscriptionId = String(body.razorpay_subscription_id ?? "").trim();
  const razorpayOrderId = String(body.razorpay_order_id ?? "").trim();
  const razorpayPaymentId = String(body.razorpay_payment_id ?? "").trim();
  const razorpaySignature = String(body.razorpay_signature ?? "").trim();
  const razorpayPlanId = String(body.razorpay_plan_id ?? body.planId ?? "").trim();

  if (!razorpayConfigured()) {
    return NextResponse.json(
      { error: "Online payment is not configured. Add Razorpay test keys to the server .env file." },
      { status: 503 },
    );
  }

  if (!body.termsAccepted) {
    return NextResponse.json({ error: "Accept the Terms & Conditions to complete registration." }, { status: 400 });
  }

  if (!razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json(
      { error: "Complete Razorpay payment before registering the hospital." },
      { status: 400 },
    );
  }

  if (mode === "subscription") {
    if (!razorpaySubscriptionId) {
      return NextResponse.json({ error: "Missing Razorpay subscription payment details." }, { status: 400 });
    }
    if (
      !verifyRazorpaySubscriptionSignature({
        paymentId: razorpayPaymentId,
        subscriptionId: razorpaySubscriptionId,
        signature: razorpaySignature,
      })
    ) {
      return NextResponse.json({ error: "Payment verification failed. Try again." }, { status: 400 });
    }
  } else {
    if (!razorpayOrderId) {
      return NextResponse.json({ error: "Missing Razorpay order payment details." }, { status: 400 });
    }
    if (
      !verifyRazorpayPaymentSignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      })
    ) {
      return NextResponse.json({ error: "Payment verification failed. Try again." }, { status: 400 });
    }
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

    const razorpay = getRazorpayClient();
    const expectedPaise = toPaise(prepared.quote.total);
    const payment = await razorpay.payments.fetch(razorpayPaymentId);
    // Subscription card-auth (deferred start_at) often uses a ₹5 token that Razorpay
    // auto-refunds; status becomes "refunded" even though auth succeeded.
    const paymentStatus = String(payment.status ?? "").toLowerCase();
    const paymentOk =
      paymentStatus === "captured" ||
      paymentStatus === "authorized" ||
      paymentStatus === "refunded";
    if (!paymentOk) {
      return NextResponse.json({ error: "Payment was not completed successfully." }, { status: 400 });
    }

    let planId = razorpayPlanId;
    let subscriptionCurrentStart: number | null | undefined;
    let subscriptionCurrentEnd: number | null | undefined;
    let subscriptionChargeAt: number | null | undefined;
    let subscriptionStatus: ReturnType<typeof mapRazorpaySubscriptionStatus> | undefined;
    let deferredBilling = false;
    let trialEndsAt: Date | null = null;
    let paymentNotes = `Razorpay order ${razorpayOrderId} · payment ${razorpayPaymentId}`;
    let invoiceStatus: "PAID" | "ISSUED" = "PAID";

    if (mode === "subscription") {
      const subscription = await razorpay.subscriptions.fetch(razorpaySubscriptionId);
      planId = planId || String(subscription.plan_id ?? "");
      if (!planId) {
        return NextResponse.json(
          { error: "Razorpay plan id missing on subscription. Cannot complete registration." },
          { status: 400 },
        );
      }
      const plan = await razorpay.plans.fetch(planId);
      if (Number(plan.item.amount) !== expectedPaise) {
        return NextResponse.json(
          { error: "Paid subscription amount does not match the registration package total." },
          { status: 400 },
        );
      }
      subscriptionCurrentStart = subscription.current_start;
      subscriptionCurrentEnd = subscription.current_end;
      subscriptionChargeAt = subscription.charge_at;
      subscriptionStatus = mapRazorpaySubscriptionStatus(String(subscription.status ?? "AUTHENTICATED"));
      const startAtUnix =
        typeof subscription.start_at === "number"
          ? subscription.start_at
          : typeof subscription.charge_at === "number"
            ? subscription.charge_at
            : null;
      deferredBilling = Boolean(startAtUnix && startAtUnix * 1000 > Date.now());
      // Deferred trial: auth may be ₹0 / small token — do not require full plan amount today.
      if (!deferredBilling && Number(payment.amount) !== expectedPaise) {
        return NextResponse.json({ error: "Paid amount does not match the package total." }, { status: 400 });
      }
      trialEndsAt = unixToDate(startAtUnix) ?? trialEndsAtFromNow();
      // First real charge happens at start_at — do not issue a bill for the trial month.
      invoiceStatus = deferredBilling ? "ISSUED" : "PAID";
      paymentNotes = deferredBilling
        ? `Razorpay card authorised · subscription ${razorpaySubscriptionId} · first charge after trial · payment ${razorpayPaymentId}`
        : `Razorpay subscription ${razorpaySubscriptionId} · payment ${razorpayPaymentId}`;
      // Prefer charge_at, else deferred start_at, for nextChargeAt display.
      subscriptionChargeAt =
        typeof subscription.charge_at === "number"
          ? subscription.charge_at
          : typeof startAtUnix === "number"
            ? startAtUnix
            : subscriptionChargeAt;
    } else {
      if (Number(payment.amount) !== expectedPaise) {
        return NextResponse.json({ error: "Paid amount does not match the package total." }, { status: 400 });
      }
      const order = await razorpay.orders.fetch(razorpayOrderId);
      if (Number(order.amount) !== expectedPaise) {
        return NextResponse.json(
          { error: "Paid order amount does not match the registration package total." },
          { status: 400 },
        );
      }
    }

    const result = await registerHospital({
      name: prepared.name,
      code: prepared.code,
      address: prepared.address,
      phone: prepared.phone,
      adminUsername: prepared.adminUsername,
      adminMobile: prepared.adminMobile,
      adminEmail: prepared.adminEmail,
      adminPassword: prepared.adminPassword,
      tierId: prepared.tierId,
      invoiceStatus,
      skipInvoice: mode === "subscription" && deferredBilling,
      paymentMethod: "UPI" as PaymentMethod,
      paymentNotes,
      termsAccepted: true,
      referralCode: body.referralCode != null ? String(body.referralCode) : null,
      trialEndsAt: mode === "subscription" ? trialEndsAt : null,
      ...doctorProfileFromBody(body),
      razorpayPlanId: mode === "subscription" ? planId || null : null,
      razorpaySubscriptionId: mode === "subscription" ? razorpaySubscriptionId : null,
      razorpayPaymentId,
      subscriptionStatus: mode === "subscription" ? subscriptionStatus ?? "AUTHENTICATED" : null,
      subscriptionCurrentStart,
      subscriptionCurrentEnd,
      subscriptionChargeAt,
      actor: {
        username: prepared.adminUsername,
        role: "SUPER_ADMIN",
      },
      request,
    });

    if (result.superAdmin) {
      await createSession(result.superAdmin.id);
    }

    return NextResponse.json({
      ok: true,
      mode,
      deferredBilling,
      hospital: { id: result.hospital.id, name: result.hospital.name, code: result.hospital.code },
      invoice: result.invoice
        ? {
            id: result.invoice.id,
            invoiceNo: result.invoice.invoiceNo,
            total: result.quote.total,
            status: result.invoice.status,
          }
        : null,
      payment: {
        razorpaySubscriptionId: mode === "subscription" ? razorpaySubscriptionId : null,
        razorpayOrderId: mode === "order" ? razorpayOrderId : null,
        razorpayPaymentId,
      },
      redirectTo: homeForRole("SUPER_ADMIN", result.hospital.id),
    });
  } catch (error) {
    if (error instanceof HospitalRegistrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Hospital self-registration with Razorpay failed", error);
    return NextResponse.json({ error: "Could not register hospital after payment." }, { status: 500 });
  }
}
