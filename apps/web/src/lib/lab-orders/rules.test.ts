import { describe, expect, it } from "vitest";
import { isAllowedLabReport } from "@/lib/lab-report-store";
import {
  canCollectLabPayment,
  canCollectSample,
  canSaveLabResults,
  canUploadLabReport,
  canViewLabReport,
  requiresReportBeforeDone,
  validateLabCollectionPayment,
} from "@/lib/lab-orders/rules";
import { labOrderPatchSchema } from "@/lib/validation/lab";

describe("lab order rules", () => {
  it("requires payment before sample collection or results", () => {
    expect(canCollectSample("PAID")).toBe(true);
    expect(canCollectSample("AWAITING_PAYMENT")).toBe(false);
    expect(canSaveLabResults("SAMPLE_COLLECTED")).toBe(true);
    expect(canSaveLabResults("AWAITING_PAYMENT")).toBe(false);
    expect(requiresReportBeforeDone(null)).toBe(true);
    expect(requiresReportBeforeDone("report.pdf")).toBe(false);
  });

  it("blocks collecting payment on external or empty orders", () => {
    expect(
      canCollectLabPayment({ fulfillment: "EXTERNAL", status: "AWAITING_PAYMENT", itemCount: 1 }),
    ).toMatchObject({ ok: false, status: 409 });
    expect(canCollectLabPayment({ fulfillment: "IN_HOUSE", status: "PAID", itemCount: 1 })).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(canCollectLabPayment({ fulfillment: "IN_HOUSE", status: "AWAITING_PAYMENT", itemCount: 0 })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(canCollectLabPayment({ fulfillment: "IN_HOUSE", status: "AWAITING_PAYMENT", itemCount: 2 }).ok).toBe(true);
  });

  it("requires full lab amount and a card brand for card payments", () => {
    expect(
      validateLabCollectionPayment({ method: "CASH", amount: 50, due: 100 }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      validateLabCollectionPayment({ method: "CARD", amount: 100, due: 100, cardBrand: "" }),
    ).toMatchObject({ ok: false, error: "Choose a card type." });
    expect(validateLabCollectionPayment({ method: "CASH", amount: 100, due: 100 }).ok).toBe(true);
  });

  it("restricts report upload and view by role and status", () => {
    expect(
      canUploadLabReport({ role: "LAB_TECH", fulfillment: "IN_HOUSE", status: "AWAITING_PAYMENT" }),
    ).toMatchObject({ ok: false, status: 409 });
    expect(canUploadLabReport({ role: "LAB_TECH", fulfillment: "IN_HOUSE", status: "PAID" }).ok).toBe(true);
    expect(canViewLabReport({ role: "ACCOUNTANT", fulfillment: "IN_HOUSE", status: "RESULTED" })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(canViewLabReport({ role: "LAB_TECH", fulfillment: "IN_HOUSE", status: "RESULTED" })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(canViewLabReport({ role: "DOCTOR", fulfillment: "IN_HOUSE", status: "RESULTED" }).ok).toBe(true);
  });

  it("accepts PDF reports under 8 MB", () => {
    expect(isAllowedLabReport("application/pdf", 1024)).toBe(true);
    expect(isAllowedLabReport("application/zip", 1024)).toBe(false);
    expect(isAllowedLabReport("application/pdf", 9 * 1024 * 1024)).toBe(false);
  });
});

describe("lab schemas", () => {
  it("rejects an unknown lab PATCH action", () => {
    expect(labOrderPatchSchema.safeParse({ action: "delete" }).success).toBe(false);
    expect(labOrderPatchSchema.safeParse({ action: "collect-sample" }).success).toBe(true);
  });
});
