import { describe, expect, it } from "vitest";
import { ageFromDateInput, ageYears, dateOfBirthFromAge, parsePatientAge } from "@/lib/display";

describe("patient age helpers", () => {
  it("parses whole years from 0 to 150 and rejects invalid values", () => {
    expect(parsePatientAge("0")).toBe(0);
    expect(parsePatientAge(40)).toBe(40);
    expect(parsePatientAge(" 12 ")).toBe(12);
    expect(parsePatientAge("")).toBeNull();
    expect(parsePatientAge("12.5")).toBeNull();
    expect(parsePatientAge("abc")).toBeNull();
    expect(parsePatientAge(151)).toBeNull();
  });

  it("derives a date of birth that still reports the same age", () => {
    const now = new Date(2026, 8, 20);
    const dob = dateOfBirthFromAge(35, now);
    expect(dob).toEqual(new Date(1991, 8, 20));
    expect(ageYears(dob, now)).toBe(35);
  });

  it("computes age from a date input without timezone shift", () => {
    expect(ageFromDateInput("1991-09-20", new Date(2026, 8, 20))).toBe("35");
    expect(ageFromDateInput("invalid")).toBeNull();
  });
});
