import { z } from "zod";
import { LAB_COLLECTION_METHODS } from "@/lib/lab-orders/types";

const PATCH_ACTIONS = ["collect-sample", "save-results", "mark-done"] as const;

export const labOrderPatchSchema = z.object({
  action: z.enum(PATCH_ACTIONS, { error: "Unknown action." }),
  notes: z.unknown().optional(),
});

export const labCollectSchema = z.preprocess(
  (raw) => (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
  z
    .object({
      method: z.unknown().optional(),
      amount: z.unknown().optional(),
      cardBrand: z.unknown().optional(),
      cardLast4: z.unknown().optional(),
      referenceNo: z.unknown().optional(),
    })
    .transform((data) => ({
      method: String(data.method ?? "CASH"),
      amount: data.amount === undefined || data.amount === null || data.amount === "" ? undefined : Number(data.amount),
      cardBrand: String(data.cardBrand ?? "").trim(),
      cardLast4: String(data.cardLast4 ?? "").replace(/\D/g, "").slice(-4),
      referenceNo: String(data.referenceNo ?? "").trim(),
    }))
    .superRefine((data, ctx) => {
      if (data.method && !(LAB_COLLECTION_METHODS as readonly string[]).includes(data.method) && data.amount !== undefined) {
        ctx.addIssue({ code: "custom", message: "Choose cash, card, or UPI and enter a valid amount." });
      }
    }),
);
