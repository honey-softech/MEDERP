/** Fixed monthly subscription tiers — OPD staff seats only (pharmacy / lab / wards / inventory later). */

export const SUBSCRIPTION_TIER_IDS = ["CLINIC", "STARTER", "GROWTH"] as const;
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
 * Three OPD plans. Modules (pharmacy, lab, inventory, wards) are off until offered later.
 * Seats are fungible across doctor / nurse / receptionist / other staff.
 * Plan 1: the hospital admin login is extra. It uses a seat only when that admin also
 * practices as a doctor (one account, not two). Separate doctor → 4 accounts including
 * admin. Admin-as-doctor → 3 accounts.
 * Plan 2 and Plan 3: hospital admin uses one seat. Admin-as-doctor does not add another.
 */
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "CLINIC",
    name: "Plan 1",
    tagline: "Base OPD clinic",
    monthlyFee: 2_499,
    seatLimit: 3,
    roleSuggestion: "Admin login plus 1 doctor and 2 nurses — or admin-as-doctor plus 2 staff",
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "3 staff logins (doctor, nurse, receptionist, or other staff)",
      "Hospital admin is an extra login when they are not a doctor — 4 accounts total",
      "If the admin is also the doctor, that one login uses a staff seat — 3 accounts total",
      "Nurse-as-receptionist does not add a second login",
      "OPD, billing, appointments",
      "Nurse station (OPD vitals)",
      "Visit summary and prescription print",
      "1-month free trial",
    ],
  },
  {
    id: "STARTER",
    name: "Plan 2",
    tagline: "Growing OPD",
    monthlyFee: 4_499,
    seatLimit: 6,
    roleSuggestion: "1 admin doctor + more doctors/nurses/receptionists",
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "6 login seats total (hospital admin counts as 1)",
      "Suggested: 1 admin as doctor + doctors, nurses, or receptionists",
      "Everything in Plan 1",
      "Nurse station (OPD vitals)",
      "1-month free trial",
    ],
  },
  {
    id: "GROWTH",
    name: "Plan 3",
    tagline: "Larger OPD team",
    monthlyFee: 5_999,
    seatLimit: 9,
    roleSuggestion: "1 admin doctor + larger clinical and front-desk team",
    pharmacyEnabled: false,
    labEnabled: false,
    inventoryEnabled: false,
    wardsEnabled: false,
    nurseStation: true,
    features: [
      "9 login seats total (hospital admin counts as 1)",
      "Suggested: 1 admin as doctor + doctors, nurses, or receptionists",
      "Everything in Plan 2",
      "Nurse station (OPD vitals)",
      "1-month free trial",
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
