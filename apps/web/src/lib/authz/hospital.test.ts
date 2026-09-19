import { describe, expect, it } from "vitest";
import {
  BILLING_ROLES,
  FRONT_DESK_ROLES,
  canAddWalkIn,
  canRegisterPatient,
  forbidUnless,
  hasBillingAccess,
  hasFrontDeskAccess,
  hasRoleAccess,
  withNurseReceptionist,
} from "@/lib/authz/hospital";

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

  it("keeps nurse off the front desk until Superadmin opts in", () => {
    expect(hasFrontDeskAccess({ role: "NURSE" })).toBe(false);
    expect(hasBillingAccess({ role: "NURSE" })).toBe(false);
    expect(canRegisterPatient({ role: "NURSE" })).toBe(false);
    expect(forbidUnless({ role: "NURSE" }, FRONT_DESK_ROLES)?.status).toBe(403);
  });

  it("lets every nurse cover reception when the hospital toggle is on, without removing receptionist", () => {
    const hospital = { nurseAsReceptionist: true };
    expect(hasFrontDeskAccess({ role: "NURSE", hospital })).toBe(true);
    expect(hasFrontDeskAccess({ role: "RECEPTIONIST", hospital })).toBe(true);
    expect(hasBillingAccess({ role: "NURSE", hospital })).toBe(true);
    expect(canAddWalkIn({ role: "NURSE", hospital })).toBe(true);
    expect(canRegisterPatient({ role: "NURSE", hospital })).toBe(true);
    expect(forbidUnless({ role: "NURSE", hospital }, FRONT_DESK_ROLES)).toBeNull();
    expect(forbidUnless({ role: "NURSE", hospital }, BILLING_ROLES)).toBeNull();
    expect(hasRoleAccess({ role: "NURSE", hospital }, ["SUPER_ADMIN", "RECEPTIONIST"])).toBe(true);
    expect(withNurseReceptionist(["SUPER_ADMIN", "DOCTOR"], hospital)).toEqual(["SUPER_ADMIN", "DOCTOR"]);
  });
});
