import { NextResponse } from "next/server";
import { HospitalRegistrationError, prepareHospitalRegistration } from "@/lib/hospital-registration";
import {
  createRazorpaySubscription,
  resolveOrCreatePlan,
} from "@/lib/hospital-subscription";
import {
  getRazorpayClient,
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
      adminPassword: String(body.adminPassword ?? ""),
      tierId: body.tierId != null ? String(body.tierId) : undefined,
      extraStaffSlots: Number(body.extraStaffSlots ?? 0),
      pharmacyEnabled: Boolean(body.pharmacyEnabled),
      labEnabled: Boolean(body.labEnabled),
      termsAccepted: true,
    });

    const amountPaise = toPaise(prepared.quote.total);
    if (amountPaise < 100) {
      return NextResponse.json({ error: "Payable amount is too small for Razorpay." }, { status: 400 });
    }

    const base = {
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
      },
      hospitalName: prepared.name,
    };

    try {
      const plan = await resolveOrCreatePlan({
        hospitalCode: prepared.code,
        amountInr: prepared.quote.total,
        description: `MedERP monthly · ${prepared.code}`,
      });
      const subscription = await createRazorpaySubscription({
        planId: plan.id,
        hospitalCode: prepared.code,
        adminUsername: prepared.adminUsername,
      });

      return NextResponse.json({
        ...base,
        mode: "subscription",
        subscriptionId: subscription.id,
        planId: plan.id,
        shortUrl: (subscription as { short_url?: string }).short_url ?? null,
        recurring: true,
      });
    } catch (subscriptionError) {
      // Plans/Subscriptions may be disabled or return 401 while Orders still work.
      console.warn(
        "Razorpay subscription path failed; trying one-time Order for registration.",
        razorpayErrorMessage(subscriptionError),
      );
    }

    try {
      const razorpay = getRazorpayClient();
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `reg_${prepared.code}_${Date.now()}`.slice(0, 40),
        notes: {
          purpose: "hospital_registration",
          hospitalCode: prepared.code,
          adminUsername: prepared.adminUsername,
        },
      });

      return NextResponse.json({
        ...base,
        mode: "order",
        orderId: order.id,
        recurring: false,
        notice:
          "Razorpay Subscriptions is not available with these keys yet, so this payment is one-time. After registration, link monthly auto-debit from Subscription once Razorpay enables Subscriptions.",
      });
    } catch (orderError) {
      console.error("Razorpay registration Order fallback failed", orderError);
      const razorpayMessage = razorpayErrorMessage(orderError);
      const authFailed =
        razorpayMessage.toLowerCase().includes("expired") ||
        razorpayMessage.toLowerCase().includes("authentication failed") ||
        razorpayMessage.toLowerCase().includes("regenerate");
      return NextResponse.json(
        {
          error: razorpayMessage
            ? `Could not start online payment: ${razorpayMessage}`
            : "Could not start online payment. Check Razorpay keys in apps/web/.env and restart the server.",
        },
        { status: authFailed ? 401 : 500 },
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
