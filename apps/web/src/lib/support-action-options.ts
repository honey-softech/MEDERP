export type SupportActionTier = "support" | "admin";

export const SUPPORT_ACTIONS = [
  { id: "RESET_PASSWORD", tier: "support", label: "Reset password" },
  { id: "FIX_MOBILE", tier: "support", label: "Correct login mobile" },
  { id: "MARK_VERIFIED", tier: "support", label: "Mark verified" },
  { id: "REACTIVATE_USER", tier: "support", label: "Reactivate account" },
  { id: "CLEAR_OTP_LOCK", tier: "support", label: "Clear OTP lockout" },
  { id: "SIGN_OUT_ALL", tier: "support", label: "Sign out all sessions" },
  { id: "EXTEND_TRIAL", tier: "admin", label: "Extend trial" },
  { id: "GRANT_SEATS", tier: "admin", label: "Grant extra seats" },
  { id: "HOSPITAL_ACCESS", tier: "admin", label: "Stop or restore hospital access" },
] as const;

export type SupportActionId = (typeof SUPPORT_ACTIONS)[number]["id"];

/** Runnable helpdesk support actions (admin-tier catalog items are UI-only for now). */
export type SupportTierActionId = Extract<(typeof SUPPORT_ACTIONS)[number], { tier: "support" }>["id"];

export const SUPPORT_TIER_ACTION_IDS = new Set<string>(
  SUPPORT_ACTIONS.filter((action) => action.tier === "support").map((action) => action.id),
);

export function supportActionLabel(id: string) {
  return SUPPORT_ACTIONS.find((action) => action.id === id)?.label ?? id;
}

export function isSupportTierAction(id: string): id is SupportTierActionId {
  return SUPPORT_TIER_ACTION_IDS.has(id);
}
