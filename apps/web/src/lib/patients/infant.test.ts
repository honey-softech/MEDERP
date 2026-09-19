import { describe, expect, it } from "vitest";
import { babyOfName, isUnnamedInfantName, parentNameFromPatient } from "@/lib/patients/infant";
import { createPatientSchema } from "@/lib/validation/patient";

describe("unnamed infant naming", () => {
  it("builds Baby of parent name and detects it later", () => {
    expect(babyOfName("  Ramesh   Kumar ")).toBe("Baby of Ramesh Kumar");
    expect(babyOfName("")).toBe("");
    expect(isUnnamedInfantName("Baby of Ramesh Kumar")).toBe(true);
    expect(isUnnamedInfantName("Aarav Kumar")).toBe(false);
    expect(parentNameFromPatient({ firstName: "Ramesh", lastName: "Kumar" })).toBe("Ramesh Kumar");
  });

  it("registers an unnamed infant from parent name without a given name", () => {
    const parsed = createPatientSchema.safeParse({
      unnamedInfant: true,
      parentName: "Ramesh Kumar",
      gender: "MALE",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.firstName).toBe("Baby of Ramesh Kumar");
    expect(parsed.data.lastName).toBe("");
    expect(parsed.data.dateOfBirth.getFullYear()).toBe(new Date().getFullYear());
  });

  it("allows unnamed infant when linked under a family head without parentName", () => {
    const parsed = createPatientSchema.safeParse({
      unnamedInfant: true,
      familyOfPatientId: "parent-1",
      familyRelation: "CHILD",
      gender: "FEMALE",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.unnamedInfant).toBe(true);
    expect(parsed.data.familyOfPatientId).toBe("parent-1");
  });

  it("rejects unnamed infant with no parent and still requires a name for other patients", () => {
    expect(createPatientSchema.safeParse({ unnamedInfant: true, gender: "MALE" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ dateOfBirth: "2020-01-01", gender: "MALE" }).success).toBe(false);
    const named = createPatientSchema.safeParse({
      firstName: "Ramesh",
      lastName: "Kumar",
      dateOfBirth: "1985-03-15",
      gender: "MALE",
    });
    expect(named.success).toBe(true);
  });
});
