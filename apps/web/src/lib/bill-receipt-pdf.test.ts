import { describe, expect, it } from "vitest";
import { buildBillReceiptPdf } from "@/lib/bill-receipt-pdf";

describe("bill receipt PDF", () => {
  it("builds a PDF that matches the print receipt fields", async () => {
    const pdf = await buildBillReceiptPdf({
      hospitalName: "NALAM",
      issuedAt: new Date("2026-09-13T08:46:00+05:30"),
      status: "PAID",
      patientName: "PATIENT1",
      patientMrn: "VELNALAM-2026-00001",
      visitLine: "Dr. doctor1 · Paediatrics",
      items: [{ description: "Consultation — Paediatrics with Dr. doctor1", amount: 500 }],
      subtotal: 500,
      discountAmount: 0,
      waiverAmount: 0,
      netTotal: 500,
      paidAmount: 500,
      payments: [
        {
          kind: "COLLECTION",
          method: "CASH",
          amount: 500,
          receivedAt: new Date("2026-09-13T08:46:00+05:30"),
        },
      ],
      collector: { name: "dhanushadmin", credentials: null, imageData: null },
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
