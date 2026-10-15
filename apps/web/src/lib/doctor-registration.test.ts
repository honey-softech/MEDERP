import { describe, expect, it } from "vitest";
import { doctorProfileFromBody } from "@/lib/hospital-registration";

describe("admin doctor registration", () => {
  it("keeps the department chosen before payment", () => {
    const parsed = doctorProfileFromBody({
      adminAsDoctor: true,
      doctorProfile: {
        specialization: "Cardiology",
        departmentName: "Cardiology",
        medicalRegNo: "KA12345",
      },
    });
    expect(parsed.adminAsDoctor).toBe(true);
    expect(parsed.doctorProfile?.departmentName).toBe("Cardiology");
    expect(parsed.doctorProfile?.specialization).toBe("Cardiology");
    expect(parsed.doctorProfile?.medicalRegNo).toBe("KA12345");
  });

  it("uses the specialty as the department when only the specialty was sent", () => {
    const parsed = doctorProfileFromBody({
      adminAsDoctor: true,
      doctorProfile: { specialization: "ENT", medicalRegNo: "TN9" },
    });
    expect(parsed.doctorProfile?.departmentName).toBe("ENT");
  });
});
