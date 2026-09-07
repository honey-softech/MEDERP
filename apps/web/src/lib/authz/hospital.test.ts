import { describe, expect, it } from "vitest";
import { BILLING_ROLES, FRONT_DESK_ROLES, canAddWalkIn, canRegisterPatient, forbidUnless } from "@/lib/authz/hospital";

describe("authz", () => {
  it("forbids roles outside the allowed list", () => {
    expect(forbidUnless("NURSE", FRONT_DESK_ROLES)?.status).toBe(403);
    expect(forbidUnless("RECEPTIONIST", FRONT_DESK_ROLES)).toBeNull();
    expect(forbidUnless("ACCOUNTANT", BILLING_ROLES)).toBeNull();
    expect(forbidUnless("PHARMACIST", BILLING_ROLES)?.status).toBe(403);
  });

  it("allows doctor walk-in by default and nurse only when hospital enables it", () => {
    expect(canAddWalkIn({ role: "DOCTOR", hospital: {} })).toBe(true);
    expect(canAddWalkIn({ role: "DOCTOR", hospital: { walkInByDoctor: false } })).toBe(false);
    expect(canAddWalkIn({ role: "NURSE", hospital: {} })).toBe(false);
    expect(canAddWalkIn({ role: "NURSE", hospital: { walkInByNurse: true } })).toBe(true);
  });

  it("lets reception and doctors register patients, not pharmacy", () => {
    expect(canRegisterPatient({ role: "RECEPTIONIST" })).toBe(true);
    expect(canRegisterPatient({ role: "DOCTOR" })).toBe(true);
    expect(canRegisterPatient({ role: "PHARMACIST" })).toBe(false);
  });
});
