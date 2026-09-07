export type LabActionResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; status: number };

export const LAB_COLLECTION_METHODS = ["CASH", "CARD", "UPI"] as const;
export const LAB_CARD_BRANDS = ["Visa", "Mastercard", "RuPay", "Amex", "Other"] as const;
