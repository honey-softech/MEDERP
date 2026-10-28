import { describe, expect, it } from "vitest";
import { canApplyLeave } from "@/lib/staff-leave";

describe("canApplyLeave", () => {
  it("lets hospital staff open their own leave page", () => {
    expect(canApplyLeave("DOCTOR")).toBe(true);
    expect(canApplyLeave("NURSE")).toBe(true);
    expect(canApplyLeave("RECEPTIONIST")).toBe(true);
  });

  it("lets a hospital admin who practices as a doctor apply from the Leave page", () => {
    expect(canApplyLeave("SUPER_ADMIN", { role: "DOCTOR", isActive: true })).toBe(true);
  });

  it("sends a hospital admin without a doctor profile away from the staff leave page", () => {
    expect(canApplyLeave("SUPER_ADMIN")).toBe(false);
    expect(canApplyLeave("SUPER_ADMIN", { role: "DOCTOR", isActive: false })).toBe(false);
    expect(canApplyLeave("SOFTWARE_ADMIN")).toBe(false);
  });
});
