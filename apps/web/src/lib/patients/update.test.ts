import { describe, expect, it } from "vitest";
import { mergeBlockedByAdmissions } from "@/lib/patients/merge";
import { buildPatientUpdatePayload } from "@/lib/patients/update";
import { linkFamilySchema, mergePatientSchema } from "@/lib/validation/patient";

describe("patient update payload", () => {
  it("lets front desk change demographics and ignores hospitalId", () => {
    const result = buildPatientUpdatePayload({
      isFrontDesk: true,
      existing: { firstName: "Ravi", lastName: "Kumar" },
      body: {
        firstName: "Ravi",
        lastName: "Sharma",
        phone: "9876543210",
        hospitalId: "other-hospital",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.lastName).toBe("Sharma");
    expect(result.data.phone).toBe("9876543210");
    expect(result.data).not.toHaveProperty("hospitalId");
  });

  it("lets a clinician change only clinical history", () => {
    const ignored = buildPatientUpdatePayload({
      isFrontDesk: false,
      existing: { firstName: "Ravi", lastName: "Kumar" },
      body: { firstName: "Hacked", allergies: "Penicillin" },
    });
    expect(ignored.ok).toBe(true);
    if (!ignored.ok) return;
    expect(ignored.data).toEqual({ allergies: "Penicillin" });
    expect(ignored.data).not.toHaveProperty("firstName");
  });

  it("rejects an invalid gender and empty clinician patches", () => {
    expect(
      buildPatientUpdatePayload({
        isFrontDesk: true,
        existing: { firstName: "Ravi", lastName: "Kumar" },
        body: { gender: "ALIEN" },
      }),
    ).toEqual({ ok: false, error: "Select a valid gender." });

    expect(
      buildPatientUpdatePayload({
        isFrontDesk: false,
        existing: { firstName: "Ravi", lastName: "Kumar" },
        body: { firstName: "Nope" },
      }),
    ).toEqual({ ok: false, error: "No changes provided." });
  });
});

describe("patient merge and family", () => {
  it("blocks merge when both records have an active admission", () => {
    expect(mergeBlockedByAdmissions(1, 1)).toBe(true);
    expect(mergeBlockedByAdmissions(1, 0)).toBe(false);
    expect(mergeBlockedByAdmissions(0, 0)).toBe(false);
  });

  it("rejects merging a patient into themselves", () => {
    const parsed = mergePatientSchema.safeParse({ duplicateId: "" });
    expect(parsed.success).toBe(false);
  });

  it("requires a valid family relation", () => {
    expect(linkFamilySchema.safeParse({ relatedPatientId: "p2", relation: "COUSIN" }).success).toBe(false);
    const ok = linkFamilySchema.safeParse({ relatedPatientId: "p2", relation: "CHILD" });
    expect(ok.success).toBe(true);
  });
});
