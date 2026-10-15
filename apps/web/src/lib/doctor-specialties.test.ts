import { describe, expect, it } from "vitest";
import { visitSignoffLine } from "./doctor-specialties";

describe("visit sign-off line", () => {
  it("prints the specialty once when the department is also present", () => {
    expect(visitSignoffLine("Cardiology", "General Medicine")).toBe("Cardiology");
    expect(visitSignoffLine("MBBS, Cardiology\nGeneral Medicine", "General Medicine")).toBe("Cardiology");
  });

  it("falls back to the department when no specialty was saved", () => {
    expect(visitSignoffLine(null, "Paediatrics")).toBe("Paediatrics");
  });
});
