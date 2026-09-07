export type BillingActionResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; status: number };

export const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "INSURANCE", "ADVANCE"] as const;
export type BillingPaymentMethod = (typeof PAYMENT_METHODS)[number];
