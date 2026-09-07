import { describe, expect, it } from "vitest";
import { belongsToHospital, hospitalScope } from "@/lib/tenancy";
import { createPatientSchema } from "@/lib/validation/patient";

describe("tenancy", () => {
  it("scopes queries to the actor hospital and rejects other hospitals' records", () => {
    expect(hospitalScope("hosp-a")).toEqual({ hospitalId: "hosp-a" });
    expect(belongsToHospital({ hospitalId: "hosp-a" }, "hosp-a")).toBe(true);
    expect(belongsToHospital({ hospitalId: "hosp-b" }, "hosp-a")).toBe(false);
    expect(belongsToHospital(null, "hosp-a")).toBe(false);
  });

  it("does not accept hospitalId from the client on patient create", () => {
    const parsed = createPatientSchema.safeParse({
      firstName: "Ravi",
      lastName: "Kumar",
      dateOfBirth: "2000-01-15",
      gender: "MALE",
      hospitalId: "some-other-hospital",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).not.toHaveProperty("hospitalId");
  });
});
