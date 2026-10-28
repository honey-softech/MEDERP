import { TRIAL_MONTHS } from "@/lib/hospital-access";

/** Extra free months granted to the referrer for one approved referral. */
export const REFERRAL_REWARD_MONTHS = 1;
/** How many clinics one hospital may refer (pending + approved). */
export const MAX_REFERRALS_PER_HOSPITAL = 3;
/** Base trial plus referral bonus. Referral rewards stop once this total is reached. */
export const MAX_TOTAL_FREE_MONTHS = 3;
export const MAX_REFERRAL_BONUS_MONTHS = MAX_TOTAL_FREE_MONTHS - TRIAL_MONTHS;
