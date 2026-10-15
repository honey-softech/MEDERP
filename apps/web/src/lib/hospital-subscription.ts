import type { Hospital, HospitalSubscription, HospitalSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { countHospitalStaffSeats, createPlatformInvoice } from "@/lib/platform-billing";
import { notifySubscriptionRenewalBill } from "@/lib/platform-invoice-whatsapp";
import { extraUsersBelowUsageError, pricingFromTier } from "@/lib/platform-pricing";
import { getRazorpayClient, razorpayConfigured, toPaise } from "@/lib/razorpay";
import { trialEndsAtFromNow } from "@/lib/hospital-access";
import {
  getSubscriptionTier,
  hospitalFieldsFromTier,
  isSubscriptionTierId,
  normalizeSubscriptionTierId,
  parseExtraUserCount,
  requireSubscriptionTier,
} from "@/lib/subscription-tiers";

const SUBSCRIPTION_TOTAL_COUNT = 12; // 12 monthly charges; cancel anytime

/** Unix `start_at` for Razorpay: card now, first plan debit after the free trial month. */
export function deferredSubscriptionStartAtUnix(now = new Date()) {
  return Math.floor(trialEndsAtFromNow(now).getTime() / 1000);
}
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

export async function monthlyAmountForSelection(selection: { tierId: string; extraUsers?: number }) {
  return pricingFromTier(selection.tierId, selection.extraUsers ?? 0);
}

export async function monthlyAmountForHospital(
  hospital: Pick<
    Hospital,
    "subscriptionTier" | "includedStaffSlots" | "extraStaffSlots" | "pharmacyEnabled" | "labEnabled"
  >,
) {
  const tierId =
    hospital.subscriptionTier && isSubscriptionTierId(hospital.subscriptionTier)
      ? hospital.subscriptionTier
      : normalizeSubscriptionTierId(hospital.subscriptionTier);
  return pricingFromTier(tierId, hospital.extraStaffSlots);
}

export function configuredRazorpayPlanId(tierId?: string) {
  const normalized = String(tierId ?? "")
    .trim()
    .toUpperCase();
  const byTier: Record<string, string | undefined> = {
    CLINIC: process.env.RAZORPAY_PLAN_ID_CLINIC,
    STARTER: process.env.RAZORPAY_PLAN_ID_STARTER,
    GROWTH: process.env.RAZORPAY_PLAN_ID_GROWTH,
    PLUS: process.env.RAZORPAY_PLAN_ID_PLUS,
  };
  const fromTier = normalized ? byTier[normalized]?.trim() : "";
  if (fromTier) return fromTier;
  return process.env.RAZORPAY_PLAN_ID?.trim() || "";
}

export async function resolveOrCreatePlan(params: {
  hospitalCode: string;
  amountInr: number;
  description: string;
  tierId?: string;
  extraUsers?: number;
}) {
  const configuredId = configuredRazorpayPlanId(params.tierId);
  const amountPaise = toPaise(params.amountInr);
  const extraUsers = Math.max(0, Math.trunc(params.extraUsers ?? 0));
  if (amountPaise < 100) {
    throw new Error("Monthly amount is too small for Razorpay.");
  }

  const razorpay = getRazorpayClient();
  if (configuredId && extraUsers === 0) {
    try {
      const plan = await razorpay.plans.fetch(configuredId);
      if (Number(plan.item.amount) === amountPaise) {
        return plan;
      }
      console.warn(
        `Razorpay plan ${configuredId} amount ${plan.item.amount} paise does not match quote ${amountPaise} paise; looking up or creating a matching plan.`,
      );
    } catch {
      // Configured plan missing — create or reuse a matching plan.
    }
  }

  return findOrCreateTierPlan({
    tierId: params.tierId || "CLINIC",
    amountInr: params.amountInr,
    description: params.description,
    extraUsers,
    hospitalCode: params.hospitalCode,
  });
}

type RazorpayPlanItem = {
  id: string;
  item: { amount: number | string };
  notes?: Record<string, string>;
};

export async function findOrCreateTierPlan(params: {
  tierId: string;
  amountInr: number;
  description: string;
  extraUsers: number;
  hospitalCode?: string;
}) {
  const razorpay = getRazorpayClient();
  const amountPaise = toPaise(params.amountInr);
  if (amountPaise < 100) {
    throw new Error("Monthly amount is too small for Razorpay.");
  }

  const listed = (await razorpay.plans.all({ count: 100 })) as { items?: RazorpayPlanItem[] };
  const match = (listed.items ?? []).find((plan) => {
    const notes = plan.notes ?? {};
    return (
      notes.purpose === "mederp_tier" &&
      notes.tierId === params.tierId &&
      String(notes.extraUsers ?? "0") === String(params.extraUsers) &&
      Number(plan.item.amount) === amountPaise
    );
  });
  if (match) return match;

  const name =
    params.extraUsers > 0
      ? `MedERP ${params.tierId} +${params.extraUsers} users`
      : `MedERP ${params.tierId}`;
  return razorpay.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: name.slice(0, 255),
      amount: amountPaise,
      currency: "INR",
      description: params.description.slice(0, 255),
    },
    notes: {
      purpose: "mederp_tier",
      tierId: params.tierId,
      extraUsers: String(params.extraUsers),
      ...(params.hospitalCode ? { hospitalCode: params.hospitalCode } : {}),
    },
  });
}

export async function createSubscriptionPlan(params: {
  hospitalCode: string;
  amountInr: number;
  description: string;
  tierId?: string;
  extraUsers?: number;
}) {
  return findOrCreateTierPlan({
    tierId: params.tierId || "CLINIC",
    amountInr: params.amountInr,
    description: params.description,
    extraUsers: params.extraUsers ?? 0,
    hospitalCode: params.hospitalCode,
  });
}

export async function createRazorpayCustomer(params: {
  name: string;
  email: string;
  contact: string;
  hospitalCode: string;
}) {
  const razorpay = getRazorpayClient();
  const email = params.email.trim().toLowerCase();
  const contact = params.contact.trim();
  const name = params.name.trim() || params.hospitalCode;

  // fail_existing: 0 returns the existing customer when email/contact already exist.
  const customer = await razorpay.customers.create({
    name: name.slice(0, 50),
    email,
    contact,
    fail_existing: 0,
    notes: {
      hospitalCode: params.hospitalCode,
      purpose: "mederp_subscription",
    },
  });
  return customer as { id: string };
}

export async function createRazorpaySubscription(params: {
  planId: string;
  hospitalCode: string;
  adminUsername?: string;
  adminEmail?: string;
  adminMobile?: string;
  /**
   * Unix seconds. When set in the future, Checkout only authenticates the card now;
   * the first plan charge runs at this time (Razorpay trial via `start_at`).
   */
  startAt?: number | null;
}) {
  const razorpay = getRazorpayClient();
  const email = params.adminEmail?.trim().toLowerCase() || "";
  const contact = params.adminMobile?.trim() || "";

  let customerId: string | undefined;
  if (email && contact) {
    const customer = await createRazorpayCustomer({
      name: params.adminUsername || params.hospitalCode,
      email,
      contact,
      hospitalCode: params.hospitalCode,
    });
    customerId = customer.id;
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  // Razorpay requires start_at to be meaningfully in the future (not "now").
  const startAt =
    typeof params.startAt === "number" && params.startAt >= nowUnix + 15 * 60 ? params.startAt : undefined;

  return razorpay.subscriptions.create({
    plan_id: params.planId,
    total_count: SUBSCRIPTION_TOTAL_COUNT,
    quantity: 1,
    customer_notify: 1,
    ...(startAt ? { start_at: startAt } : {}),
    ...(customerId ? { customer_id: customerId } : {}),
    ...(email || contact
      ? {
          notify_info: {
            ...(email ? { notify_email: email } : {}),
            ...(contact ? { notify_phone: contact } : {}),
          },
        }
      : {}),
    notes: {
      purpose: "hospital_subscription",
      hospitalCode: params.hospitalCode,
      ...(startAt ? { deferredStart: "1", trialMonths: "1" } : {}),
      ...(params.adminUsername ? { adminUsername: params.adminUsername } : {}),
      ...(email ? { adminEmail: email } : {}),
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
  /** Logins beyond the plan. Omit to keep the hospital's current extra users. */
  extraUsers?: number;
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

  const extraUsers = params.extraUsers == null ? hospital.extraStaffSlots : parseExtraUserCount(params.extraUsers);
  const tier = requireSubscriptionTier(params.tierId);
  const usedSeats = await countHospitalStaffSeats(hospital.id);
  const fitError = extraUsersBelowUsageError(tier.seatLimit, usedSeats, extraUsers);
  if (fitError) throw new Error(fitError);

  const effectiveTier = (sub.pendingSubscriptionTier || hospital.subscriptionTier) as string;
  const effectiveExtra = sub.pendingSubscriptionTier ? sub.pendingExtraStaffSlots : hospital.extraStaffSlots;
  if (effectiveTier === params.tierId && effectiveExtra === extraUsers) {
    throw new Error("That plan and extra user count are already active or already scheduled.");
  }

  const quote = await monthlyAmountForSelection({
    tierId: params.tierId,
    extraUsers,
  });

  const plan = await createSubscriptionPlan({
    hospitalCode: hospital.code,
    amountInr: quote.total,
    description: `MedERP monthly · ${quote.tier.name} · ${quote.tier.patientLimit} patients${extraUsers ? ` · +${extraUsers} users` : ""}`,
    tierId: quote.tier.id,
    extraUsers,
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

  const seatsAvailableNow = extraUsers > hospital.extraStaffSlots;
  if (seatsAvailableNow) {
    await prisma.hospital.update({
      where: { id: hospital.id },
      data: { extraStaffSlots: extraUsers },
    });
  }

  const saved = await prisma.hospitalSubscription.update({
    where: { id: sub.id },
    data: {
      pendingPlanId: plan.id,
      pendingMonthlyAmount: quote.total,
      pendingSubscriptionTier: quote.tier.id,
      pendingPharmacyEnabled: quote.tier.pharmacyEnabled,
      pendingLabEnabled: quote.tier.labEnabled,
      pendingInventoryEnabled: quote.tier.inventoryEnabled,
      pendingExtraStaffSlots: extraUsers,
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
    pendingSubscriptionTier: quote.tier.id,
    pendingExtraUsers: extraUsers,
    seatsAvailableNow,
    pendingPharmacyEnabled: quote.tier.pharmacyEnabled,
    pendingLabEnabled: quote.tier.labEnabled,
    pendingInventoryEnabled: quote.tier.inventoryEnabled,
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
    ? {
        ...hospitalFieldsFromTier(tier),
        extraStaffSlots: Math.max(0, sub.pendingExtraStaffSlots),
      }
    : {
        // Legacy pending module flags ignored — modules deferred
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

  const invoice = await createPlatformInvoice({
    hospitalId: params.hospitalId,
    lines,
    total: params.amountInr,
    paymentMethod: "UPI",
    notes: params.notes ?? "Razorpay subscription charge",
    status: "PAID",
    razorpayPaymentId: params.razorpayPaymentId ?? null,
    razorpaySubscriptionId: params.razorpaySubscriptionId ?? null,
  });
  await notifySubscriptionRenewalBill(invoice.id);
  return invoice;
}

const ENDED_SUBSCRIPTION_STATUSES = new Set<HospitalSubscriptionStatus>(["CANCELLED", "COMPLETED", "EXPIRED"]);

/**
 * Stops Razorpay billing for a hospital that is being removed.
 * Looks up the subscription by hospital, so it still runs after the hospital super admin is detached.
 */
export async function cancelSubscriptionForClosedHospital(hospitalId: string) {
  const sub = await prisma.hospitalSubscription.findUnique({ where: { hospitalId } });
  if (!sub) return { cancelled: false as const, reason: "none" as const };
  if (ENDED_SUBSCRIPTION_STATUSES.has(sub.status)) {
    return { cancelled: true as const, reason: "already" as const, subscriptionId: sub.id };
  }

  if (!razorpayConfigured()) {
    await prisma.hospitalSubscription.update({
      where: { id: sub.id },
      data: {
        status: "CANCELLED",
        cancelAtPeriodEnd: false,
        cancelledAt: new Date(),
        nextChargeAt: null,
      },
    });
    return { cancelled: true as const, reason: "local" as const, subscriptionId: sub.id };
  }

  try {
    const updated = await cancelHospitalSubscription({ hospitalId, atCycleEnd: false });
    return { cancelled: true as const, reason: "razorpay" as const, subscriptionId: updated.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel the hospital subscription.";
    if (/already been cancelled|already cancelled|not found|does not exist|no such/i.test(message)) {
      await prisma.hospitalSubscription.update({
        where: { id: sub.id },
        data: {
          status: "CANCELLED",
          cancelAtPeriodEnd: false,
          cancelledAt: sub.cancelledAt ?? new Date(),
          nextChargeAt: null,
        },
      });
      return { cancelled: true as const, reason: "already" as const, subscriptionId: sub.id };
    }
    return { cancelled: false as const, reason: "failed" as const, error: message };
  }
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
