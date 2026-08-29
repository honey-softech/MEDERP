import type { Hospital } from "@prisma/client";
import {
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

export function pricingFromTier(tierId: string) {
  const tier = requireSubscriptionTier(tierId);
  const seatLabel =
    tier.seatLimit == null ? "unlimited staff seats" : `${tier.seatLimit} staff seats (any roles)`;
  const lines: PricingLine[] = [
    {
      description: `${tier.name} plan — ${seatLabel}`,
      amount: tier.monthlyFee,
    },
  ];
  return {
    lines,
    total: tier.monthlyFee,
    tier,
    includedStaffSlots: tier.seatLimit ?? 0,
    extraStaffSlots: 0,
    unlimitedStaffSeats: tier.seatLimit == null,
    maxStaffSlots: tier.seatLimit,
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
  // Legacy a la carte → nearest fixed tier for old clients
  const seats = 3 + Math.max(0, Math.trunc(Number((selection as { extraStaffSlots?: number }).extraStaffSlots ?? 0)));
  const pharmacy = Boolean((selection as { pharmacyEnabled?: boolean }).pharmacyEnabled);
  const lab = Boolean((selection as { labEnabled?: boolean }).labEnabled);
  let tierId: SubscriptionTierId = "CLINIC";
  if (seats >= 50 && pharmacy && lab) tierId = "ENTERPRISE";
  else if (seats >= 15 && pharmacy && lab) tierId = "PROFESSIONAL";
  else if (pharmacy || lab) tierId = "GROWTH";
  else if (seats >= 6) tierId = "STARTER";
  return pricingFromTier(tierId);
}

export function staffSeatLimit(
  hospital: Pick<Hospital, "includedStaffSlots" | "extraStaffSlots" | "unlimitedStaffSeats" | "subscriptionTier">,
): number | null {
  if (hospital.unlimitedStaffSeats) return null;
  const tier = getSubscriptionTier(hospital.subscriptionTier);
  if (tier?.seatLimit == null && hospital.subscriptionTier === "ENTERPRISE") return null;
  if (tier?.seatLimit != null) return tier.seatLimit;
  return hospital.includedStaffSlots + hospital.extraStaffSlots;
}

/** Staff roles count toward seat limit; super admin is excluded. */
export function isStaffSeatRole(role: string) {
  return role !== "SUPER_ADMIN" && role !== "SOFTWARE_ADMIN" && role !== "HELPDESK";
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
    return "Pharmacy module is not on your plan. Upgrade to Growth or higher.";
  }
  if (roleRequiresLabModule(role) && !hospital.labEnabled) {
    return "Laboratory module is not on your plan. Upgrade to Growth or higher.";
  }
  return null;
}

export { hospitalFieldsFromTier };
