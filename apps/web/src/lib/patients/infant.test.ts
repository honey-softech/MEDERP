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
      phone: "9876543210",
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
      phone: "9876543210",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.unnamedInfant).toBe(true);
    expect(parsed.data.familyOfPatientId).toBe("parent-1");
  });

  it("rejects unnamed infant with no parent and still requires a name and mobile for other patients", () => {
    expect(createPatientSchema.safeParse({ unnamedInfant: true, gender: "MALE", phone: "9876543210" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ dateOfBirth: "2020-01-01", gender: "MALE", phone: "9876543210" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ firstName: "Ramesh", gender: "MALE", phone: "9876543210" }).success).toBe(false);
    expect(
      createPatientSchema.safeParse({
        firstName: "Ramesh",
        lastName: "Kumar",
        dateOfBirth: "1985-03-15",
        gender: "MALE",
      }).success,
    ).toBe(false);
    const named = createPatientSchema.safeParse({
      firstName: "Ramesh",
      lastName: "Kumar",
      dateOfBirth: "1985-03-15",
      gender: "MALE",
      phone: "9876543210",
    });
    expect(named.success).toBe(true);
  });

  it("registers a named patient with age when date of birth is omitted", () => {
    const now = new Date();
    const parsed = createPatientSchema.safeParse({
      firstName: "Ramesh",
      lastName: "Kumar",
      age: 40,
      gender: "MALE",
      phone: "9876543210",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.dateOfBirth.getFullYear()).toBe(now.getFullYear() - 40);
    expect(parsed.data.dateOfBirth.getMonth()).toBe(now.getMonth());
    expect(parsed.data.dateOfBirth.getDate()).toBe(now.getDate());
  });

  it("keeps an explicit date of birth when both age and date of birth are sent", () => {
    const parsed = createPatientSchema.safeParse({
      firstName: "Ramesh",
      age: 10,
      dateOfBirth: "1985-03-15",
      gender: "MALE",
      phone: "9876543210",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.dateOfBirth.toISOString().slice(0, 10)).toBe("1985-03-15");
  });
});
