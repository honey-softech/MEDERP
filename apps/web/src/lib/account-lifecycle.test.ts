import { describe, expect, it } from "vitest";
import { lastSuperAdminBlocksSelfService } from "@/lib/account-guards";
import { hashOtp, otpDigest } from "@/lib/otp-digest";

describe("purpose-bound OTP", () => {
  it("hashes destructive actions with their purpose and leaves signup as digits only", () => {
    expect(otpDigest("123456", "signup")).toBe(hashOtp("123456"));
    expect(otpDigest("123456", "close-hospital")).toBe(hashOtp("close-hospital:123456"));
    expect(otpDigest("123456", "leave-hospital")).toBe(hashOtp("leave-hospital:123456"));
    expect(otpDigest("123456", "delete-account")).toBe(hashOtp("delete-account:123456"));
    expect(otpDigest("123456", "close-hospital")).not.toBe(otpDigest("123456", "delete-account"));
    expect(otpDigest("123456", "close-hospital")).not.toBe(otpDigest("123456", "signup"));
  });
});

describe("last super admin guard", () => {
  it("blocks leave and delete only for the sole admin of an open hospital", () => {
    expect(
      lastSuperAdminBlocksSelfService({
        role: "SUPER_ADMIN",
        hospitalIsActive: true,
        otherActiveSuperAdmins: 0,
      }),
    ).toBe(true);
    expect(
      lastSuperAdminBlocksSelfService({
        role: "SUPER_ADMIN",
        hospitalIsActive: true,
        otherActiveSuperAdmins: 1,
      }),
    ).toBe(false);
    expect(
      lastSuperAdminBlocksSelfService({
        role: "SUPER_ADMIN",
        hospitalIsActive: false,
        otherActiveSuperAdmins: 0,
      }),
    ).toBe(false);
    expect(
      lastSuperAdminBlocksSelfService({
        role: "DOCTOR",
        hospitalIsActive: true,
        otherActiveSuperAdmins: 0,
      }),
    ).toBe(false);
  });
});
