import type { Hospital } from "@prisma/client";
import {
  EXTRA_USER_MONTHLY_FEE,
  getSubscriptionTier,
  hospitalFieldsFromTier,
  requireSubscriptionTier,
  type SubscriptionTierId,
} from "@/lib/subscription-tiers";

export type SubscriptionSelection = {
  tierId: SubscriptionTierId;
};

export type PricingLine = {
  description: string;
  amount: number;
};

/** GST on MedERP SaaS subscription (monthly plan fee). */
export const SUBSCRIPTION_GST_PERCENT = 18;

/** Round GST to nearest rupee (Indian invoicing convention for whole-rupee plans). */
export function subscriptionGstAmount(baseInr: number) {
  const base = Math.max(0, Math.round(Number(baseInr) || 0));
  return Math.round((base * SUBSCRIPTION_GST_PERCENT) / 100);
}

export function subscriptionTotalWithGst(baseInr: number) {
  const base = Math.max(0, Math.round(Number(baseInr) || 0));
  return base + subscriptionGstAmount(base);
}

export function pricingFromTier(tierId: string, extraUsers = 0) {
  const tier = requireSubscriptionTier(tierId);
  const extras = Math.max(0, Math.trunc(Number(extraUsers) || 0));
  const extraFee = extras * EXTRA_USER_MONTHLY_FEE;
  const subtotal = tier.monthlyFee + extraFee;
  const gstAmount = subscriptionGstAmount(subtotal);
  const total = subtotal + gstAmount;
  const seatLabel = tier.seatLimit == null ? "unlimited users" : `${tier.seatLimit} users`;
  const lines: PricingLine[] = [
    {
      description: `${tier.name} — ${seatLabel}, ${tier.patientLimit.toLocaleString("en-IN")} patients`,
      amount: tier.monthlyFee,
    },
  ];
  if (extraFee > 0) {
    lines.push({
      description: `${extras} extra user${extras === 1 ? "" : "s"} at ₹${EXTRA_USER_MONTHLY_FEE}`,
      amount: extraFee,
    });
  }
  lines.push({
    description: `GST (${SUBSCRIPTION_GST_PERCENT}%)`,
    amount: gstAmount,
  });
  return {
    lines,
    subtotal,
    gstPercent: SUBSCRIPTION_GST_PERCENT,
    gstAmount,
    total,
    tier,
    extraUsers: extras,
    includedStaffSlots: tier.seatLimit ?? 0,
    extraStaffSlots: extras,
    unlimitedStaffSeats: tier.seatLimit == null,
    maxStaffSlots: tier.seatLimit == null ? null : tier.seatLimit + extras,
    patientLimit: tier.patientLimit,
    pharmacyEnabled: tier.pharmacyEnabled,
    labEnabled: tier.labEnabled,
    inventoryEnabled: tier.inventoryEnabled,
  };
}

/** @deprecated Prefer pricingFromTier — kept for callers still building selection objects. */
export function pricingFromSettings(
  _settings: unknown,
  selection: SubscriptionSelection | { extraStaffSlots?: number; pharmacyEnabled?: boolean; labEnabled?: boolean; tierId?: string },
) {
  if ("tierId" in selection && selection.tierId) {
    return pricingFromTier(selection.tierId);
  }
  // Legacy a la carte → nearest fixed OPD tier for old clients
  const seats = 3 + Math.max(0, Math.trunc(Number((selection as { extraStaffSlots?: number }).extraStaffSlots ?? 0)));
  let tierId: SubscriptionTierId = "CLINIC";
  if (seats >= 9) tierId = "GROWTH";
  else if (seats >= 6) tierId = "STARTER";
  return pricingFromTier(tierId);
}

export function staffSeatLimit(
  hospital: Pick<Hospital, "includedStaffSlots" | "extraStaffSlots" | "unlimitedStaffSeats" | "subscriptionTier">,
): number | null {
  if (hospital.unlimitedStaffSeats) return null;
  const tier = getSubscriptionTier(hospital.subscriptionTier);
  const included = tier?.seatLimit ?? hospital.includedStaffSlots;
  return included + Math.max(0, hospital.extraStaffSlots);
}

/** Platform roles never use a hospital seat. Plan 1 admin exemption is applied in countHospitalStaffSeats. */
export function isStaffSeatRole(role: string) {
  return role !== "SOFTWARE_ADMIN" && role !== "HELPDESK";
}

export function roleRequiresPharmacyModule(role: string) {
  return role === "PHARMACIST";
}

export function roleRequiresLabModule(role: string) {
  return role === "LAB_TECH";
}

export function moduleErrorForRole(
  role: string,
  hospital: Pick<Hospital, "pharmacyEnabled" | "labEnabled">,
) {
  if (roleRequiresPharmacyModule(role) && !hospital.pharmacyEnabled) {
    return "Pharmacy module is not available on your plan yet.";
  }
  if (roleRequiresLabModule(role) && !hospital.labEnabled) {
    return "Laboratory module is not available on your plan yet.";
  }
  return null;
}

export { hospitalFieldsFromTier };
