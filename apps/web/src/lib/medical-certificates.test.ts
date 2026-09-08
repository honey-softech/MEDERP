import { describe, expect, it } from "vitest";
import {
  certificateLetter,
  certificateTitle,
  parseCertificateInput,
  parseCertificateType,
  restPeriodLabel,
} from "@/lib/medical-certificates";

describe("medical certificates", () => {
  it("accepts typed certificates and rejects unknown types", () => {
    expect(parseCertificateType("sick_leave")).toBe("SICK_LEAVE");
    expect(parseCertificateType("FITNESS")).toBe("FITNESS");
    expect(parseCertificateType("other")).toBeNull();
  });

  it("requires rest dates for sick leave and rejects inverted ranges", () => {
    expect(
      parseCertificateInput({
        type: "SICK_LEAVE",
        diagnosis: "Viral fever",
      }),
    ).toEqual({ ok: false, error: "Choose rest from and to dates." });

    expect(
      parseCertificateInput({
        type: "SICK_LEAVE",
        diagnosis: "Viral fever",
        restFrom: "2026-09-10",
        restTo: "2026-09-08",
      }),
    ).toEqual({ ok: false, error: "Rest end date must be on or after the start date." });

    const ok = parseCertificateInput({
      type: "SICK_LEAVE",
      diagnosis: "Viral fever",
      restFrom: "2026-09-08",
      restTo: "2026-09-10",
    });
    expect(ok.ok).toBe(true);
  });

  it("requires fitness purpose and general purpose", () => {
    expect(parseCertificateInput({ type: "FITNESS", diagnosis: "Recovered" })).toEqual({
      ok: false,
      error: "Choose what the patient is fit for.",
    });
    expect(parseCertificateInput({ type: "GENERAL", diagnosis: "Anemia" })).toEqual({
      ok: false,
      error: "Describe the purpose of this certificate.",
    });
    expect(parseCertificateInput({ type: "FITNESS", diagnosis: "Recovered", fitFor: "WORK" }).ok).toBe(true);
    expect(
      parseCertificateInput({ type: "GENERAL", diagnosis: "Anemia", purpose: "requires extra rest at school" }).ok,
    ).toBe(true);
  });

  it("writes letter wording by type", () => {
    expect(certificateTitle("SICK_LEAVE")).toContain("Sick leave");
    const letter = certificateLetter({
      type: "SICK_LEAVE",
      patientName: "Ravi Kumar",
      mrn: "HOSP-2026-00001",
      dateOfBirth: new Date("1990-01-15"),
      gender: "MALE",
      diagnosis: "Viral fever",
      restFrom: new Date("2026-09-08"),
      restTo: new Date("2026-09-10"),
      issuedAt: new Date("2026-09-08"),
    });
    expect(letter).toContain("Ravi Kumar");
    expect(letter).toContain("Viral fever");
    expect(letter).toContain(restPeriodLabel(new Date("2026-09-08"), new Date("2026-09-10")));
  });
});
