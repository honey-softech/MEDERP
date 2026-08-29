import type { Hospital, HospitalSubscription } from "@prisma/client";

/** Free trial length for every subscription plan. */
export const TRIAL_MONTHS = 1;

const PAID_STATUSES = new Set(["ACTIVE", "AUTHENTICATED", "PENDING"]);

export function trialEndsAtFromNow(now = new Date()) {
  const ends = new Date(now.getTime());
  ends.setMonth(ends.getMonth() + TRIAL_MONTHS);
  return ends;
}

export function hospitalHasActivePaidSubscription(
  subscription: Pick<HospitalSubscription, "status" | "currentPeriodEnd"> | null | undefined,
) {
  if (!subscription) return false;
  if (!PAID_STATUSES.has(subscription.status)) return false;
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < Date.now()) return false;
  return true;
}

/** True when a trial hospital has expired and has not started a paid subscription. Legacy hospitals (no trialEndsAt) stay open. */
export function hospitalAccessBlocked(hospital: {
  trialEndsAt?: Date | null;
  subscription?: Pick<HospitalSubscription, "status" | "currentPeriodEnd"> | null;
} | null | undefined) {
  if (!hospital) return false;
  if (hospitalHasActivePaidSubscription(hospital.subscription)) return false;
  if (!hospital.trialEndsAt) return false;
  return hospital.trialEndsAt.getTime() <= Date.now();
}

export function trialDaysRemaining(trialEndsAt: Date | null | undefined, now = new Date()) {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function isExpiredTrialAllowedPath(pathname: string) {
  if (pathname === "/subscribe" || pathname.startsWith("/subscribe/")) return true;
  if (pathname === "/hospital/subscription" || pathname.startsWith("/hospital/subscription/")) return true;
  if (pathname.startsWith("/api/hospital/subscription")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}
