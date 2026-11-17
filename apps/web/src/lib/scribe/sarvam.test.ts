import { describe, expect, it } from "vitest";
import { decideClipSeq, sarvamLanguageCode, sarvamModel, scribeListener, clipWithinLimit } from "@/lib/scribe/sarvam";

describe("sarvam language and provider", () => {
  it("maps Tamil, Hindi, Kannada, Malayalam, and Auto", () => {
    expect(sarvamLanguageCode("ta")).toBe("ta-IN");
    expect(sarvamLanguageCode("hi")).toBe("hi-IN");
    expect(sarvamLanguageCode("kn")).toBe("kn-IN");
    expect(sarvamLanguageCode("ml")).toBe("ml-IN");
    expect(sarvamLanguageCode("auto")).toBe("unknown");
    expect(sarvamLanguageCode("en")).toBe("unknown");
  });

  it("keeps clips to 30 seconds", () => {
    expect(clipWithinLimit(0)).toBe(true);
    expect(clipWithinLimit(15_000)).toBe(true);
    expect(clipWithinLimit(30_000)).toBe(true);
    expect(clipWithinLimit(30_001)).toBe(false);
    expect(clipWithinLimit(Number.NaN)).toBe(false);
  });

  it("orders clip lines the same way as live segments", () => {
    expect(decideClipSeq(1, 0, 300)).toBe("ok");
    expect(decideClipSeq(1, 1, 300)).toBe("duplicate");
    expect(decideClipSeq(3, 1, 300)).toBe("order");
    expect(decideClipSeq(301, 300, 300)).toBe("long");
    expect(decideClipSeq(0, 0, 300)).toBe("invalid");
  });

  it("uses Sarvam for Tamil, Hindi, and Auto only when the key is set", () => {
    const withKey = { SARVAM_API_KEY: "present" };
    expect(scribeListener("ta", withKey)).toBe("sarvam");
    expect(scribeListener("hi", withKey)).toBe("sarvam");
    expect(scribeListener("kn", withKey)).toBe("sarvam");
    expect(scribeListener("ml", withKey)).toBe("sarvam");
    expect(scribeListener("auto", withKey)).toBe("sarvam");
    expect(scribeListener("en", withKey)).toBe("openai");
    expect(scribeListener("ta", {})).toBe("openai");
    expect(scribeListener("ta", { SARVAM_API_KEY: "present", SCRIBE_STT_PROVIDER: "openai" })).toBe("openai");
  });

  it("defaults the model to saaras v4", () => {
    expect(sarvamModel({})).toBe("saaras:v4");
    expect(sarvamModel({ SARVAM_STT_MODEL: "saaras:v3" })).toBe("saaras:v3");
    expect(sarvamModel({ SARVAM_STT_MODEL: "other" })).toBe("saaras:v4");
  });
});
