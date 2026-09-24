import { describe, expect, it } from "vitest";
import { passwordValidationError, signInPasswordError, superAdminNameError } from "@/lib/password-policy";

describe("password policy", () => {
  it("rejects the password password and weak values", () => {
    expect(passwordValidationError("password")).toMatch(/cannot be/);
    expect(passwordValidationError("Password")).toMatch(/cannot be/);
    expect(passwordValidationError("short")).toMatch(/at least 8/);
    expect(passwordValidationError("longenough")).toMatch(/uppercase/);
    expect(passwordValidationError("Longenough")).toMatch(/number/);
    expect(passwordValidationError("Longenough1")).toMatch(/symbol/);
  });

  it("accepts a mixed password", () => {
    expect(passwordValidationError("Clinic@123")).toBeNull();
  });

  it("blocks password on sign-in without rejecting other passwords", () => {
    expect(signInPasswordError("password")).toMatch(/cannot be/);
    expect(signInPasswordError("secret")).toBeNull();
    expect(signInPasswordError("Software@123")).toBeNull();
  });

  it("rejects punctuation in the super admin name", () => {
    expect(superAdminNameError("Dr. Rao")).toMatch(/cannot include/);
    expect(superAdminNameError("Hello!")).toMatch(/cannot include/);
    expect(superAdminNameError("Rao, K")).toMatch(/cannot include/);
    expect(superAdminNameError("Dr Rao")).toBeNull();
  });
});