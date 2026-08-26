/** MedERP design system — shared Tailwind class strings */

export const fieldClass =
  "mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary-light sm:text-sm";

export const buttonClass =
  "h-10 w-full rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60";

export const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-app-bg disabled:opacity-60";

export const compactButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-primary hover:bg-app-bg disabled:opacity-60 sm:h-10 sm:rounded-lg sm:px-4 sm:text-sm";

export const compactPrimaryButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60 sm:h-10 sm:rounded-lg sm:px-4 sm:text-sm";

export const textActionClass =
  "inline-flex items-center text-xs font-medium text-text-secondary underline-offset-2 hover:text-primary hover:underline";

export const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-app-bg hover:text-text-primary";

export const cardClass =
  "rounded-lg border border-border bg-surface shadow-card";

export const statusBadgeBase =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export const statusBadge = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
  info: "bg-info-bg text-info",
  neutral: "bg-app-bg text-text-secondary",
  health: "bg-secondary-light text-secondary",
} as const;

export function labStatusClass(status: string) {
  if (status === "AWAITING_PAYMENT" || status === "AWAITING_EXTERNAL_REPORT") return statusBadge.warning;
  if (status === "PAID") return statusBadge.info;
  if (status === "SAMPLE_COLLECTED") return statusBadge.info;
  if (status === "RESULTED") return statusBadge.success;
  return statusBadge.neutral;
}

export function bedStatusClass(status: string) {
  if (status === "AVAILABLE") return statusBadge.success;
  if (status === "OCCUPIED") return statusBadge.info;
  if (status === "RESERVED") return statusBadge.warning;
  if (status === "HOUSEKEEPING") return statusBadge.warning;
  if (status === "MAINTENANCE") return statusBadge.neutral;
  if (status === "BLOCKED") return statusBadge.critical;
  return statusBadge.neutral;
}

export function ticketStatusClass(status: string) {
  if (status === "OPEN") return statusBadge.info;
  if (status === "IN_PROGRESS") return statusBadge.warning;
  if (status === "WAITING_REPLY") return statusBadge.warning;
  if (status === "RESOLVED") return statusBadge.success;
  return statusBadge.neutral;
}

/** Department / specialty tag accents — small badges only */
export const deptTag = {
  pediatrics: "bg-[#F3E5F5] text-[#7E57C2]",
  cardiology: "bg-[#FFF3E0] text-[#FB8C00]",
  oncology: "bg-[#FCE4EC] text-[#EC407A]",
} as const;
