import { describe, expect, it } from "vitest";
import { audioFilename, normalizeAudioMime } from "@/lib/scribe/audio";

describe("scribe audio types", () => {
  it("accepts the MPEG-4 type an iPad recorder puts on an audio file", () => {
    expect(normalizeAudioMime("video/mp4")).toBe("audio/mp4");
    expect(normalizeAudioMime("audio/mp4;codecs=mp4a.40.2")).toBe("audio/mp4");
    expect(audioFilename("audio/mp4")).toBe("chunk.m4a");
  });

  it("keeps webm and rejects an unknown type", () => {
    expect(normalizeAudioMime("video/webm")).toBe("audio/webm");
    expect(normalizeAudioMime("audio/aac")).toBeNull();
  });
});
