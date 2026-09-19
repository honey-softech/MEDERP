import { describe, expect, it } from "vitest";
import { adminDisplayName, billingPeriodLabel } from "@/lib/platform-invoice-whatsapp";

describe("subscription bill helpers", () => {
  it("uses the SUPER_ADMIN full name, then username", () => {
    expect(adminDisplayName({ firstName: "Ravi", lastName: "Sharma", username: "apexadmin" })).toBe("Ravi Sharma");
    expect(adminDisplayName({ firstName: null, lastName: null, username: "apexadmin" })).toBe("apexadmin");
  });

  it("formats the subscription period for the WhatsApp template", () => {
    expect(billingPeriodLabel(new Date(2026, 8, 19), new Date(2026, 9, 18))).toBe("19 Sep 2026 – 18 Oct 2026");
    expect(billingPeriodLabel(null, null, new Date(2026, 8, 19))).toBe("September 2026");
    expect(billingPeriodLabel()).toBe("this billing cycle");
  });
});
