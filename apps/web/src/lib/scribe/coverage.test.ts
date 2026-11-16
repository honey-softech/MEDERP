import { describe, expect, it } from "vitest";
import { coverText, emptyCoverage, markAsked, nextMissing, topicHeard } from "@/lib/scribe/coverage";

describe("consult coverage", () => {
  it("hears a Tamil complaint and an English medicine from separate lines", () => {
    let mask = emptyCoverage();
    mask = coverText(mask, "Patient has thalavali");
    expect(topicHeard(mask, "chiefComplaint")).toBe(true);
    expect(topicHeard(mask, "medicines")).toBe(false);
    mask = coverText(mask, "மருந்து paracetamol");
    expect(topicHeard(mask, "medicines")).toBe(true);
    expect(nextMissing(mask)).toBe("history");
  });

  it("scans only the new line and keeps topics already marked", () => {
    const asked = markAsked(emptyCoverage(), "examination");
    const mask = coverText(asked, "come back in three days");
    expect(topicHeard(mask, "examination")).toBe(true);
    expect(topicHeard(mask, "followUp")).toBe(true);
    expect(nextMissing(mask)).toBe("chiefComplaint");
  });

  it("reports nothing missing when every topic was heard", () => {
    let mask = emptyCoverage();
    mask = coverText(
      mask,
      "headache for two days. examination normal. diagnosis viral. tablet morning. advice rest. follow-up",
    );
    expect(nextMissing(mask)).toBeNull();
  });
});
