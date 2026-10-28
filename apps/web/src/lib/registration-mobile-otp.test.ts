import { describe, expect, it } from "vitest";
import { registrationProofError, registrationProofProblem } from "@/lib/registration-mobile-otp";

const mobile = "9876543210";
const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

describe("registration WhatsApp proof", () => {
  it("accepts a verified proof for the same admin mobile", () => {
    expect(
      registrationProofProblem(
        { mobile, verifiedAt: new Date(), consumedAt: null, proofExpiresAt: future },
        mobile,
      ),
    ).toBeNull();
  });

  it("rejects a missing, mismatched, used, or expired proof", () => {
    expect(registrationProofProblem(null, mobile)).toBe("missing");
    expect(
      registrationProofProblem(
        { mobile: "9123456789", verifiedAt: new Date(), consumedAt: null, proofExpiresAt: future },
        mobile,
      ),
    ).toBe("mismatch");
    expect(
      registrationProofProblem(
        { mobile, verifiedAt: new Date(), consumedAt: new Date(), proofExpiresAt: future },
        mobile,
      ),
    ).toBe("used");
    expect(
      registrationProofProblem(
        { mobile, verifiedAt: new Date(), consumedAt: null, proofExpiresAt: past },
        mobile,
      ),
    ).toBe("expired");
  });

  it("tells the caller to verify the admin WhatsApp number", () => {
    expect(registrationProofError("missing")).toMatch(/WhatsApp number/);
    expect(registrationProofError("mismatch")).toMatch(/admin number/);
  });
});
