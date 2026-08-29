/** Fixed monthly subscription tiers — not a la carte. */

export const SUBSCRIPTION_TIER_IDS = ["CLINIC", "STARTER", "GROWTH", "PROFESSIONAL", "ENTERPRISE"] as const;
export type SubscriptionTierId = (typeof SUBSCRIPTION_TIER_IDS)[number];

export const DEFAULT_SUBSCRIPTION_TIER_ID: SubscriptionTierId = "CLINIC";

export type SubscriptionTier = {
  id: SubscriptionTierId;
  name: string;
  tagline: string;
  /** Monthly fee in INR */
  monthlyFee: number;
  /** Total staff seats (any mix of roles). null = unlimited. Super admin is free and does not count. */
  seatLimit: number | null;
  /** Suggested role mix for registration UI only — hospitals may allocate seats freely. */
  roleSuggestion: string;
  pharmacyEnabled: boolean;
  labEnabled: boolean;
  inventoryEnabled: boolean;
  /** Inpatient wards & beds — Professional and Enterprise only */
  wardsEnabled: boolean;
  nurseStation: boolean;
  features: string[];
};

/**
 * Clinic-first pricing. CLINIC is the default for 1–2 doctor practices.
 * Seats are fungible across doctor / nurse / receptionist / other staff roles.
 */
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "CLINIC",
    name: "Clinic",
    tagline: "Small OPD clinic",
    monthlyFee: 2_000,
    seatLimit: 3,
    roleSuggestion: "Suggested mix: 1 doctor, 1 nurse, 1 receptionist",
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "3 staff seats (any roles)",
      "OPD, billing, appointments",
      "Nurse station (OPD vitals)",
      "Visit summary and prescription print",
      "1-month free trial",
      "No wards, pharmacy, or lab",
    ],
  },
  {
    id: "STARTER",
    name: "Starter",
    tagline: "Growing OPD",
    monthlyFee: 2_999,
    seatLimit: 6,
    roleSuggestion: "Suggested mix: 2 doctors, 3 nurses, 1 receptionist",
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "6 staff seats (any roles)",
      "Everything in Clinic",
      "Nurse station (OPD vitals)",
      "1-month free trial",
      "No wards, pharmacy, or lab",
    ],
  },
  {
    id: "GROWTH",
    name: "Growth",
    tagline: "Pharmacy + lab",
    monthlyFee: 6_999,
    seatLimit: 10,
    roleSuggestion: "Suggested mix: 4 doctors, 6 nurses",
    pharmacyEnabled: true,
    labEnabled: true,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "10 staff seats (any roles)",
      "Everything in Starter",
      "Pharmacy (prescription billing)",
      "Laboratory module",
      "1-month free trial",
      "No inpatient wards",
    ],
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    tagline: "Wards + inventory",
    monthlyFee: 12_999,
    seatLimit: 20,
    roleSuggestion: "Suggested mix: 8 doctors, 12 nurses",
    pharmacyEnabled: true,
    labEnabled: true,
    inventoryEnabled: true,
    wardsEnabled: true,
    nurseStation: true,
    features: [
      "20 staff seats (any roles)",
      "Everything in Growth",
      "Inpatient wards, beds & admissions",
      "Pharmacy inventory & stock-in (GRN)",
      "1-month free trial",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    tagline: "Unlimited staff",
    monthlyFee: 25_000,
    seatLimit: null,
    roleSuggestion: "Unlimited staff users — allocate roles as you like",
    pharmacyEnabled: true,
    labEnabled: true,
    inventoryEnabled: true,
    wardsEnabled: true,
    nurseStation: true,
    features: [
      "Unlimited staff seats",
      "Everything in Professional",
      "Wards, pharmacy, lab, and inventory",
      "Best for multi-specialty hospitals",
      "1-month free trial",
    ],
  },
];

export function isSubscriptionTierId(value: string): value is SubscriptionTierId {
  return (SUBSCRIPTION_TIER_IDS as readonly string[]).includes(value);
}

export function getSubscriptionTier(id: string | null | undefined): SubscriptionTier | null {
  if (!id || !isSubscriptionTierId(id)) return null;
  return SUBSCRIPTION_TIERS.find((tier) => tier.id === id) ?? null;
}

export function requireSubscriptionTier(id: string): SubscriptionTier {
  const tier = getSubscriptionTier(id);
  if (!tier) throw new Error("Invalid subscription plan.");
  return tier;
}

/** Public JSON for registration / package APIs. */
export function publicSubscriptionTiers() {
  return SUBSCRIPTION_TIERS.map((tier) => ({
    id: tier.id,
    name: tier.name,
    tagline: tier.tagline,
    monthlyFee: tier.monthlyFee,
    seatLimit: tier.seatLimit,
    roleSuggestion: tier.roleSuggestion,
    pharmacyEnabled: tier.pharmacyEnabled,
    labEnabled: tier.labEnabled,
    inventoryEnabled: tier.inventoryEnabled,
    wardsEnabled: tier.wardsEnabled,
    features: tier.features,
  }));
}

export function hospitalFieldsFromTier(tier: SubscriptionTier) {
  return {
    subscriptionTier: tier.id,
    includedStaffSlots: tier.seatLimit ?? 0,
    extraStaffSlots: 0,
    unlimitedStaffSeats: tier.seatLimit == null,
    pharmacyEnabled: tier.pharmacyEnabled,
    labEnabled: tier.labEnabled,
    inventoryEnabled: tier.inventoryEnabled,
  };
}

/** Inpatient wards are Professional and Enterprise only. */
export function hospitalHasWardsModule(hospital: {
  subscriptionTier?: string | null;
} | null | undefined) {
  const tier = getSubscriptionTier(hospital?.subscriptionTier);
  return Boolean(tier?.wardsEnabled);
}
