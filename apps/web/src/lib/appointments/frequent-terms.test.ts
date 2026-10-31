import { describe, expect, it } from "vitest";
import { clinicDayKey, rankTerms } from "@/lib/appointments/frequent-terms";

describe("rankTerms", () => {
  it("counts individual chips, not the whole comma-separated string", () => {
    const ranked = rankTerms([
      "Viral fever, Gastritis",
      "viral fever",
      "Gastritis, Headache",
      "Headache",
    ]);
    expect(ranked.slice(0, 3)).toEqual(["Gastritis", "Headache", "Viral fever"]);
  });

  it("counts a repeated chip once per visit", () => {
    expect(rankTerms(["Fever, fever", "Cough"])).toEqual(["Cough", "Fever"]);
  });

  it("splits advice on semicolons and caps the list", () => {
    const values = ["Rest; Fluids", "Rest", "Rest", "Fluids", "Diet"];
    expect(rankTerms(values, 2)).toEqual(["Rest", "Fluids"]);
  });

  it("ignores blanks", () => {
    expect(rankTerms([null, "", "  ,  ", "URTI"])).toEqual(["URTI"]);
  });
});

describe("clinicDayKey", () => {
  it("uses the India calendar day", () => {
    expect(clinicDayKey(new Date("2026-10-31T20:30:00.000Z"))).toBe("2026-11-01");
    expect(clinicDayKey(new Date("2026-10-31T12:00:00.000Z"))).toBe("2026-10-31");
  });
});
