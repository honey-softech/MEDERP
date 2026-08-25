import type { Hospital, HospitalSubscription, HospitalSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPlatformInvoice } from "@/lib/platform-billing";
import { pricingFromTier } from "@/lib/platform-pricing";
import { getRazorpayClient, toPaise } from "@/lib/razorpay";
import {
  getSubscriptionTier,
  hospitalFieldsFromTier,
  isSubscriptionTierId,
  type SubscriptionTierId,
} from "@/lib/subscription-tiers";

const SUBSCRIPTION_TOTAL_COUNT = 120; // 10 years of monthly cycles; cancel anytime

export function unixToDate(value?: number | null) {
  if (!value) return null;
  return new Date(value * 1000);
}

export function mapRazorpaySubscriptionStatus(status: string): HospitalSubscriptionStatus {
  const allowed: HospitalSubscriptionStatus[] = [
    "CREATED",
    "AUTHENTICATED",
    "ACTIVE",
    "PENDING",
    "HALTED",
    "CANCELLED",
    "COMPLETED",
    "EXPIRED",
  ];
  const upper = status.toUpperCase() as HospitalSubscriptionStatus;
  return allowed.includes(upper) ? upper : "PENDING";
}

export async function monthlyAmountForSelection(selection: { tierId: string }) {
  return pricingFromTier(selection.tierId);
}

export async function monthlyAmountForHospital(
  hospital: Pick<
    Hospital,
    "subscriptionTier" | "includedStaffSlots" | "extraStaffSlots" | "pharmacyEnabled" | "labEnabled"
  >,
) {
  if (hospital.subscriptionTier && isSubscriptionTierId(hospital.subscriptionTier)) {
    return pricingFromTier(hospital.subscriptionTier);
  }
  const fallback: SubscriptionTierId =
    hospital.pharmacyEnabled || hospital.labEnabled ? "GROWTH" : "STARTER";
  return pricingFromTier(fallback);
}

export function configuredRazorpayPlanId() {
  return process.env.RAZORPAY_PLAN_ID?.trim() || "";
}

export async function resolveOrCreatePlan(params: {
  hospitalCode: string;
  amountInr: number;
  description: string;
}) {
  const configuredId = configuredRazorpayPlanId();
  const amountPaise = toPaise(params.amountInr);
  if (amountPaise < 100) {
    throw new Error("Monthly amount is too small for Razorpay.");
  }

  if (configuredId) {
    try {
      const razorpay = getRazorpayClient();
      const plan = await razorpay.plans.fetch(configuredId);
      if (Number(plan.item.amount) === amountPaise) {
        return plan;
      }
    } catch {
      // Configured plan missing or amount differs — create a matching plan.
    }
  }

  return createSubscriptionPlan(params);
}

export async function createSubscriptionPlan(params: {
  hospitalCode: string;
  amountInr: number;
  description: string;
}) {
  const razorpay = getRazorpayClient();
  const amountPaise = toPaise(params.amountInr);
  if (amountPaise < 100) {
    throw new Error("Monthly amount is too small for Razorpay.");
  }
  const plan = await razorpay.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `MedERP ${params.hospitalCode}`.slice(0, 255),
      amount: amountPaise,
      currency: "INR",
      description: params.description.slice(0, 255),
    },
    notes: {
      hospitalCode: params.hospitalCode,
      purpose: "mederp_monthly",
    },
  });
  return plan;
}

export async function createRazorpaySubscription(params: {
  planId: string;
  hospitalCode: string;
  adminUsername?: string;
}) {
  const razorpay = getRazorpayClient();
  return razorpay.subscriptions.create({
    plan_id: params.planId,
    total_count: SUBSCRIPTION_TOTAL_COUNT,
    quantity: 1,
    customer_notify: 1,
    notes: {
      purpose: "hospital_subscription",
      hospitalCode: params.hospitalCode,
      ...(params.adminUsername ? { adminUsername: params.adminUsername } : {}),
    },
  });
}

export async function syncSubscriptionPeriod(
  row: HospitalSubscription,
  remote: {
    status?: string;
    current_start?: number | null;
    current_end?: number | null;
    charge_at?: number | null;
    plan_id?: string;
  },
) {
  return prisma.hospitalSubscription.update({
    where: { id: row.id },
    data: {
      status: remote.status ? mapRazorpaySubscriptionStatus(remote.status) : row.status,
      razorpayPlanId: remote.plan_id || row.razorpayPlanId,
      currentPeriodStart: unixToDate(remote.current_start) ?? row.currentPeriodStart,
      currentPeriodEnd: unixToDate(remote.current_end) ?? row.currentPeriodEnd,
      nextChargeAt: unixToDate(remote.charge_at) ?? row.nextChargeAt,
    },
  });
}

export async function upsertHospitalSubscription(params: {
  hospitalId: string;
  razorpayPlanId: string;
  razorpaySubscriptionId: string;
  monthlyAmount: number;
  status?: HospitalSubscriptionStatus;
  termsAcceptedAt?: Date | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  nextChargeAt?: Date | null;
}) {
  return prisma.hospitalSubscription.upsert({
    where: { hospitalId: params.hospitalId },
    create: {
      hospitalId: params.hospitalId,
      razorpayPlanId: params.razorpayPlanId,
      razorpaySubscriptionId: params.razorpaySubscriptionId,
      monthlyAmount: params.monthlyAmount,
      status: params.status ?? "ACTIVE",
      termsAcceptedAt: params.termsAcceptedAt ?? new Date(),
      currentPeriodStart: params.currentPeriodStart ?? null,
      currentPeriodEnd: params.currentPeriodEnd ?? null,
      nextChargeAt: params.nextChargeAt ?? null,
    },
    update: {
      razorpayPlanId: params.razorpayPlanId,
      razorpaySubscriptionId: params.razorpaySubscriptionId,
      monthlyAmount: params.monthlyAmount,
      status: params.status ?? "ACTIVE",
      termsAcceptedAt: params.termsAcceptedAt ?? new Date(),
      currentPeriodStart: params.currentPeriodStart ?? null,
      currentPeriodEnd: params.currentPeriodEnd ?? null,
      nextChargeAt: params.nextChargeAt ?? null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      pendingMonthlyAmount: null,
      pendingPlanId: null,
      pendingSubscriptionTier: null,
      pendingExtraStaffSlots: 0,
      pendingPharmacyEnabled: false,
      pendingLabEnabled: false,
      pendingInventoryEnabled: false,
    },
  });
}

export async function scheduleNextCyclePackageChange(params: {
  hospitalId: string;
  tierId: string;
  termsAccepted: boolean;
}) {
  if (!params.termsAccepted) {
    throw new Error("You must accept the Terms & Conditions before updating the subscription.");
  }
  if (!isSubscriptionTierId(params.tierId)) {
    throw new Error("Choose a valid subscription plan.");
  }
  const hospital = await prisma.hospital.findUnique({
    where: { id: params.hospitalId },
    include: { subscription: true },
  });
  if (!hospital) throw new Error("Hospital not found.");
  if (!hospital.subscription?.razorpaySubscriptionId) {
    throw new Error("No active Razorpay subscription. Start monthly auto-debit first.");
  }
  const sub = hospital.subscription;
  if (["CANCELLED", "COMPLETED", "EXPIRED", "HALTED"].includes(sub.status) && !sub.cancelAtPeriodEnd) {
    throw new Error("Subscription is not active. Restart auto-debit before changing the package.");
  }

  const currentId = (sub.pendingSubscriptionTier || hospital.subscriptionTier) as string;
  if (currentId === params.tierId) {
    throw new Error("That plan is already active (or already scheduled).");
  }

  const quote = await monthlyAmountForSelection({ tierId: params.tierId });
  const tier = quote.tier;

  const plan = await createSubscriptionPlan({
    hospitalCode: hospital.code,
    amountInr: quote.total,
    description: `MedERP monthly · ${hospital.code} · ${tier.name}`,
  });

  const razorpay = getRazorpayClient();
  const remote = await razorpay.subscriptions.fetch(sub.razorpaySubscriptionId);
  const remaining =
    typeof remote.remaining_count === "number" && remote.remaining_count > 0
      ? remote.remaining_count
      : SUBSCRIPTION_TOTAL_COUNT;

  const updated = await razorpay.subscriptions.update(sub.razorpaySubscriptionId, {
    plan_id: plan.id,
    schedule_change_at: "cycle_end",
    remaining_count: remaining,
  });

  const saved = await prisma.hospitalSubscription.update({
    where: { id: sub.id },
    data: {
      pendingPlanId: plan.id,
      pendingMonthlyAmount: quote.total,
      pendingSubscriptionTier: tier.id,
      pendingPharmacyEnabled: tier.pharmacyEnabled,
      pendingLabEnabled: tier.labEnabled,
      pendingInventoryEnabled: tier.inventoryEnabled,
      pendingExtraStaffSlots: 0,
      termsAcceptedAt: new Date(),
      currentPeriodStart: unixToDate(updated.current_start) ?? sub.currentPeriodStart,
      currentPeriodEnd: unixToDate(updated.current_end) ?? sub.currentPeriodEnd,
      nextChargeAt: unixToDate(updated.charge_at) ?? sub.nextChargeAt,
      status: mapRazorpaySubscriptionStatus(updated.status),
    },
  });

  return {
    subscription: saved,
    currentMonthly: Number(sub.monthlyAmount),
    nextMonthly: quote.total,
    nextChargeAt: saved.nextChargeAt,
    pendingSubscriptionTier: tier.id,
    pendingPharmacyEnabled: tier.pharmacyEnabled,
    pendingLabEnabled: tier.labEnabled,
    pendingInventoryEnabled: tier.inventoryEnabled,
    quote,
  };
}

export async function applyPendingEntitlements(subscriptionId: string) {
  const sub = await prisma.hospitalSubscription.findUnique({
    where: { id: subscriptionId },
    include: { hospital: true },
  });
  if (!sub) return null;
  if (!sub.pendingPlanId && !sub.pendingSubscriptionTier) {
    return sub;
  }

  const tier = sub.pendingSubscriptionTier
    ? getSubscriptionTier(sub.pendingSubscriptionTier)
    : null;
  const fields = tier
    ? hospitalFieldsFromTier(tier)
    : {
        ...(sub.pendingPharmacyEnabled ? { pharmacyEnabled: true } : {}),
        ...(sub.pendingLabEnabled ? { labEnabled: true } : {}),
        ...(sub.pendingInventoryEnabled ? { inventoryEnabled: true } : {}),
        ...(sub.pendingExtraStaffSlots > 0
          ? { extraStaffSlots: { increment: sub.pendingExtraStaffSlots } }
          : {}),
      };

  return prisma.$transaction(async (tx) => {
    await tx.hospital.update({
      where: { id: sub.hospitalId },
      data: fields,
    });
    return tx.hospitalSubscription.update({
      where: { id: sub.id },
      data: {
        monthlyAmount: sub.pendingMonthlyAmount ?? sub.monthlyAmount,
        razorpayPlanId: sub.pendingPlanId ?? sub.razorpayPlanId,
        pendingMonthlyAmount: null,
        pendingPlanId: null,
        pendingSubscriptionTier: null,
        pendingExtraStaffSlots: 0,
        pendingPharmacyEnabled: false,
        pendingLabEnabled: false,
        pendingInventoryEnabled: false,
      },
    });
  });
}

export async function recordSubscriptionCharge(params: {
  hospitalId: string;
  amountInr: number;
  razorpayPaymentId?: string | null;
  razorpaySubscriptionId?: string | null;
  notes?: string;
  lines?: { description: string; amount: number }[];
}) {
  if (params.razorpayPaymentId) {
    const existing = await prisma.platformInvoice.findUnique({
      where: { razorpayPaymentId: params.razorpayPaymentId },
    });
    if (existing) return existing;
  }

  const lines =
    params.lines && params.lines.length > 0
      ? params.lines
      : [{ description: "MedERP monthly subscription", amount: params.amountInr }];

  return createPlatformInvoice({
    hospitalId: params.hospitalId,
    lines,
    total: params.amountInr,
    paymentMethod: "UPI",
    notes: params.notes ?? "Razorpay subscription charge",
    status: "PAID",
    razorpayPaymentId: params.razorpayPaymentId ?? null,
    razorpaySubscriptionId: params.razorpaySubscriptionId ?? null,
  });
}

export async function cancelHospitalSubscription(params: {
  hospitalId: string;
  atCycleEnd?: boolean;
}) {
  const sub = await prisma.hospitalSubscription.findUnique({ where: { hospitalId: params.hospitalId } });
  if (!sub) throw new Error("No Razorpay subscription found.");
  const razorpay = getRazorpayClient();
  const atCycleEnd = params.atCycleEnd !== false;
  const remote = await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, atCycleEnd);
  return prisma.hospitalSubscription.update({
    where: { id: sub.id },
    data: {
      status: mapRazorpaySubscriptionStatus(remote.status),
      cancelAtPeriodEnd: atCycleEnd && remote.status !== "cancelled",
      cancelledAt: remote.status === "cancelled" ? new Date() : sub.cancelledAt,
      currentPeriodEnd: unixToDate(remote.current_end) ?? sub.currentPeriodEnd,
      nextChargeAt: unixToDate(remote.charge_at) ?? null,
    },
  });
}
