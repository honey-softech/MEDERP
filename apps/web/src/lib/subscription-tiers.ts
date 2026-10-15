/** Fixed monthly subscription tiers — OPD staff seats only (pharmacy / lab / wards / inventory later). */

export const SUBSCRIPTION_TIER_IDS = ["CLINIC", "STARTER", "GROWTH", "PLUS"] as const;

/** Monthly fee for each login beyond the plan's included users, before GST. */
export const EXTRA_USER_MONTHLY_FEE = 300;

/** Extra logins a hospital admin can add on top of a plan. */
export const MAX_EXTRA_USERS = 100;

/** Whole-number extra users, or an error message when the value is not allowed. */
export function parseExtraUserCount(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < 0 || n > MAX_EXTRA_USERS) {
    throw new Error(`Extra users must be a whole number from 0 to ${MAX_EXTRA_USERS}.`);
  }
  return n;
}
export type SubscriptionTierId = (typeof SUBSCRIPTION_TIER_IDS)[number];

/** Older DB values — still readable, mapped onto current Plan 3. */
const LEGACY_TIER_IDS = ["PROFESSIONAL", "ENTERPRISE"] as const;

export const DEFAULT_SUBSCRIPTION_TIER_ID: SubscriptionTierId = "CLINIC";

export type SubscriptionTier = {
  id: SubscriptionTierId;
  name: string;
  tagline: string;
  /** Monthly fee in INR */
  monthlyFee: number;
  /**
   * Staff login seats. null = unlimited.
   * Plan 1: hospital admin does not use a seat unless they also practice as a doctor.
   * Plan 2 and Plan 3: hospital admin uses one seat.
   */
  seatLimit: number | null;
  /** Active patient records included in the monthly fee. */
  patientLimit: number;
  /** Suggested role mix for registration UI only — hospitals may allocate seats freely. */
  roleSuggestion: string;
  pharmacyEnabled: boolean;
  labEnabled: boolean;
  inventoryEnabled: boolean;
  /** Inpatient wards & beds — not offered on current plans */
  wardsEnabled: boolean;
  nurseStation: boolean;
  features: string[];
};

/**
 * Four OPD plans. Modules (pharmacy, lab, inventory, wards) stay off.
 * Fees are before 18% GST. Each extra user beyond the included seats is ₹300/month before GST.
 */
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "CLINIC",
    name: "Plan 1",
    tagline: "Base clinic",
    monthlyFee: 1_200,
    seatLimit: 3,
    patientLimit: 300,
    roleSuggestion: "3 users · 300 patients",
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "Up to 3 users",
      "Up to 300 patients",
      "Extra user ₹300/month",
      "OPD, billing, appointments",
      "1-month free trial, then monthly auto-debit",
    ],
  },
  {
    id: "STARTER",
    name: "Plan 2",
    tagline: "700 patients",
    monthlyFee: 2_200,
    seatLimit: 4,
    patientLimit: 700,
    roleSuggestion: "4 users · 700 patients",
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "Up to 4 users",
      "Up to 700 patients",
      "Extra user ₹300/month",
      "Everything in Plan 1",
      "1-month free trial, then monthly auto-debit",
    ],
  },
  {
    id: "GROWTH",
    name: "Plan 3",
    tagline: "1,100 patients",
    monthlyFee: 3_200,
    seatLimit: 5,
    patientLimit: 1_100,
    roleSuggestion: "5 users · 1,100 patients",
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "Up to 5 users",
      "Up to 1,100 patients",
      "Extra user ₹300/month",
      "Everything in Plan 2",
      "1-month free trial, then monthly auto-debit",
    ],
  },
  {
    id: "PLUS",
    name: "Plan 4",
    tagline: "1,500 patients",
    monthlyFee: 4_200,
    seatLimit: 6,
    patientLimit: 1_500,
    roleSuggestion: "6 users · 1,500 patients",
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "Up to 6 users",
      "Up to 1,500 patients",
      "Extra user ₹300/month",
      "Everything in Plan 3",
      "1-month free trial, then monthly auto-debit",
    ],
  },
];

export function isSubscriptionTierId(value: string): value is SubscriptionTierId {
  return (SUBSCRIPTION_TIER_IDS as readonly string[]).includes(value);
}

function isLegacyTierId(value: string): boolean {
  return (LEGACY_TIER_IDS as readonly string[]).includes(value);
}

/** Normalize any stored tier id (including legacy) onto a current sellable plan. */
export function normalizeSubscriptionTierId(id: string | null | undefined): SubscriptionTierId {
  if (id && isSubscriptionTierId(id)) return id;
  if (id && isLegacyTierId(id)) return "GROWTH";
  return DEFAULT_SUBSCRIPTION_TIER_ID;
}

export function getSubscriptionTier(id: string | null | undefined): SubscriptionTier | null {
  if (!id) return null;
  const normalized = normalizeSubscriptionTierId(id);
  return SUBSCRIPTION_TIERS.find((tier) => tier.id === normalized) ?? null;
}

export function requireSubscriptionTier(id: string): SubscriptionTier {
  const tier = getSubscriptionTier(id);
  if (!tier) throw new Error("Invalid subscription plan.");
  return tier;
}

/** Public JSON for registration / package APIs — OPD plans only, no module upsells. */
export function publicSubscriptionTiers() {
  return SUBSCRIPTION_TIERS.map((tier) => ({
    id: tier.id,
    name: tier.name,
    tagline: tier.tagline,
    monthlyFee: tier.monthlyFee,
    seatLimit: tier.seatLimit,
    patientLimit: tier.patientLimit,
    extraUserMonthlyFee: EXTRA_USER_MONTHLY_FEE,
    roleSuggestion: tier.roleSuggestion,
    features: tier.features,
  }));
}

export function hospitalFieldsFromTier(tier: SubscriptionTier) {
  return {
    subscriptionTier: tier.id,
    includedStaffSlots: tier.seatLimit ?? 0,
    extraStaffSlots: 0,
    unlimitedStaffSeats: tier.seatLimit == null,
    // Modules deferred — always off on current plans
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
  };
}

/** Inpatient wards are not on current plans. */
export function hospitalHasWardsModule(hospital: {
  subscriptionTier?: string | null;
} | null | undefined) {
  const tier = getSubscriptionTier(hospital?.subscriptionTier);
  return Boolean(tier?.wardsEnabled);
}
