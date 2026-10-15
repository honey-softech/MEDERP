import { describe, expect, it } from "vitest";
import { subscriptionCancelCanBeSkipped } from "@/lib/hospital-subscription";

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
});
