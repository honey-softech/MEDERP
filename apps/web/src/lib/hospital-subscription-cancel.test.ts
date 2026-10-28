import { describe, expect, it } from "vitest";
import { isExistingRazorpayCustomerError, postponedChargeUnix, subscriptionCanEndAtCycle, subscriptionCancelCanBeSkipped } from "@/lib/hospital-subscription";

describe("subscription cancel when removing a hospital", () => {
  it("treats a subscription Razorpay will not bill again as already finished", () => {
    expect(subscriptionCancelCanBeSkipped("Subscription is not cancellable in cancelled status")).toBe(true);
    expect(subscriptionCancelCanBeSkipped("The subscription cannot be cancelled from created status")).toBe(true);
    expect(subscriptionCancelCanBeSkipped("The id provided does not exist")).toBe(true);
  });

  it("keeps a live billing failure blocking removal", () => {
    expect(subscriptionCancelCanBeSkipped("Razorpay authentication failed")).toBe(false);
    expect(subscriptionCancelCanBeSkipped("")).toBe(false);
  });

  it("allows end-of-cycle cancel only after a billing cycle is active", () => {
    expect(subscriptionCanEndAtCycle("active")).toBe(true);
    expect(subscriptionCanEndAtCycle("authenticated")).toBe(false);
    expect(subscriptionCanEndAtCycle("created")).toBe(false);
    expect(subscriptionCanEndAtCycle("pending")).toBe(false);
  });
});

describe("first auto-debit after a referral", () => {
  const now = new Date("2026-10-28T10:00:00.000Z");

  it("moves an authorised card's first charge to the new trial end", () => {
    const desired = new Date("2026-12-15T10:00:00.000Z");
    expect(
      postponedChargeUnix({
        status: "authenticated",
        currentStartUnix: Math.floor(new Date("2026-11-15T10:00:00.000Z").getTime() / 1000),
        desiredChargeAt: desired,
        now,
      }),
    ).toBe(Math.floor(desired.getTime() / 1000));
  });

  it("leaves a charge that has already started, and does not pull a date forward", () => {
    const desired = new Date("2026-12-15T10:00:00.000Z");
    expect(
      postponedChargeUnix({
        status: "active",
        currentStartUnix: Math.floor(new Date("2026-11-15T10:00:00.000Z").getTime() / 1000),
        desiredChargeAt: desired,
        now,
      }),
    ).toBeNull();
    expect(
      postponedChargeUnix({
        status: "authenticated",
        currentStartUnix: Math.floor(desired.getTime() / 1000),
        desiredChargeAt: new Date("2026-11-20T10:00:00.000Z"),
        now,
      }),
    ).toBeNull();
  });
});

describe("existing Razorpay customer", () => {
  it("recognises the merchant duplicate error", () => {
    expect(isExistingRazorpayCustomerError(new Error("Customer already exists for the merchant"))).toBe(true);
    expect(isExistingRazorpayCustomerError(new Error("Could not start card setup"))).toBe(false);
  });
});
