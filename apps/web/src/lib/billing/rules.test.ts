import { describe, expect, it } from "vitest";
import {
  billPdfFilename,
  canSendIssuedInvoice,
  hasSendableMobile,
  invoiceDue,
  parseBillItems,
  validateDiscount,
  validatePayment,
  validateRefund,
} from "@/lib/billing/rules";
import { invoicePatchSchema, sendInvoiceSchema } from "@/lib/validation/invoice";

describe("billing rules", () => {
  it("computes due and blocks sending draft or void invoices", () => {
    expect(invoiceDue(1000, 250)).toBe(750);
    expect(canSendIssuedInvoice("ISSUED")).toBe(true);
    expect(canSendIssuedInvoice("DRAFT")).toBe(false);
    expect(canSendIssuedInvoice("VOID")).toBe(false);
    expect(hasSendableMobile("9876543210")).toBe(true);
    expect(hasSendableMobile("123")).toBe(false);
    expect(billPdfFilename("INV/1001")).toBe("bill-INV_1001.pdf");
  });

  it("rejects overpay, partial pay when full is required, and low advance", () => {
    expect(
      validatePayment({ method: "CASH", amount: 200, due: 100, requireFull: false, advanceBalance: 0 }).ok,
    ).toBe(false);
    expect(
      validatePayment({ method: "CASH", amount: 50, due: 100, requireFull: true, advanceBalance: 0 }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      validatePayment({ method: "ADVANCE", amount: 100, due: 100, requireFull: true, advanceBalance: 10 }),
    ).toMatchObject({ ok: false, status: 409 });
    expect(
      validatePayment({ method: "CASH", amount: 100, due: 100, requireFull: true, advanceBalance: 0 }).ok,
    ).toBe(true);
  });

  it("rejects a discount above subtotal or below amount already paid", () => {
    expect(validateDiscount({ discountAmount: 80, subtotal: 50, waiverAmount: 0, paidAmount: 0 })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(validateDiscount({ discountAmount: 40, subtotal: 100, waiverAmount: 0, paidAmount: 80 })).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(validateDiscount({ discountAmount: 10, subtotal: 100, waiverAmount: 0, paidAmount: 0 })).toEqual({
      ok: true,
      netTotal: 90,
    });
  });

  it("rejects a refund larger than collections", () => {
    expect(validateRefund({ method: "CASH", amount: 50, paidAmount: 20 })).toMatchObject({ ok: false, status: 400 });
    expect(validateRefund({ method: "CASH", amount: 20, paidAmount: 20 }).ok).toBe(true);
  });

  it("drops empty bill lines", () => {
    expect(
      parseBillItems([
        { description: "Consult", amount: 500 },
        { description: "", amount: 10 },
        { description: "Fee", amount: 0 },
      ]),
    ).toEqual([{ description: "Consult", amount: 500 }]);
  });
});

describe("invoice schemas", () => {
  it("defaults send channel to WhatsApp and rejects others", () => {
    expect(sendInvoiceSchema.safeParse(null).success).toBe(true);
    expect(sendInvoiceSchema.safeParse({ channel: "EMAIL" }).success).toBe(false);
  });

  it("rejects an unknown invoice PATCH action", () => {
    expect(invoicePatchSchema.safeParse({ action: "delete" }).success).toBe(false);
    expect(invoicePatchSchema.safeParse({ action: "pay", method: "CASH", amount: 100 }).success).toBe(true);
  });
});
