import { describe, expect, it } from "vitest";
import { extraPhonesForStorage, letterheadPhoneText, parseExtraPhones } from "@/lib/hospital-letterhead";

describe("clinic letterhead phones", () => {
  it("keeps the mobile and adds each landline on its own line", () => {
    const stored = extraPhonesForStorage([
      { kind: "landline", number: "044 2468 1234" },
      { kind: "landline", number: "044-2468-9999" },
    ]);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(letterheadPhoneText("9876543210", stored.value)).toBe(
      "9876543210\nLandline: 044 2468 1234\nLandline: 044-2468-9999",
    );
  });

  it("does not repeat a number already on the letterhead", () => {
    const stored = JSON.stringify([{ kind: "mobile", number: "98765 43210" }]);
    expect(letterheadPhoneText("9876543210", stored)).toBe("9876543210");
  });

  it("reads saved numbers back for the settings form", () => {
    expect(parseExtraPhones(JSON.stringify([{ kind: "landline", number: "080 4000 1000" }]))).toEqual([
      { kind: "landline", number: "080 4000 1000" },
    ]);
  });

  it("rejects a number that is not a phone", () => {
    const stored = extraPhonesForStorage([{ kind: "landline", number: "front desk" }]);
    expect(stored.ok).toBe(false);
  });
});
