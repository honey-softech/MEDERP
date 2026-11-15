import { describe, expect, it } from "vitest";
import { SCRIBE_MAX_RECORDING_MS, SCRIBE_SILENCE_ANSWER_MS, SCRIBE_SILENCE_MS } from "@/lib/scribe/limits";
import {
  isSpeechLevel,
  recordingLimitReached,
  rejectUploadReason,
  rmsFromSamples,
  silencePromptDue,
  silencePromptExpired,
  uploadDurationAllowed,
} from "@/lib/scribe/recording-guard";

describe("recording time and silence", () => {
  it("stops a recording at 5 minutes", () => {
    expect(recordingLimitReached(SCRIBE_MAX_RECORDING_MS - 1)).toBe(false);
    expect(recordingLimitReached(SCRIBE_MAX_RECORDING_MS)).toBe(true);
  });

  it("asks after 60 seconds of silence and only while the prompt is closed", () => {
    expect(silencePromptDue(SCRIBE_SILENCE_MS - 1, false)).toBe(false);
    expect(silencePromptDue(SCRIBE_SILENCE_MS, false)).toBe(true);
    expect(silencePromptDue(SCRIBE_SILENCE_MS + 5_000, true)).toBe(false);
  });

  it("stops on its own when the silence question is unanswered for 30 seconds", () => {
    expect(silencePromptExpired(SCRIBE_SILENCE_ANSWER_MS - 1)).toBe(false);
    expect(silencePromptExpired(SCRIBE_SILENCE_ANSWER_MS)).toBe(true);
  });

  it("treats a quiet microphone as silence and a raised level as speech", () => {
    expect(isSpeechLevel(rmsFromSamples([128, 128, 128, 128]))).toBe(false);
    expect(isSpeechLevel(rmsFromSamples([20, 220, 30, 210]))).toBe(true);
  });
});

describe("upload limits", () => {
  it("accepts one recording up to 5 minutes 30 seconds", () => {
    expect(uploadDurationAllowed(60_000)).toBe(true);
    expect(uploadDurationAllowed(SCRIBE_MAX_RECORDING_MS + 30_000)).toBe(true);
    expect(uploadDurationAllowed(SCRIBE_MAX_RECORDING_MS + 30_001)).toBe(false);
    expect(uploadDurationAllowed(Number.NaN)).toBe(false);
  });

  it("rejects a fourth upload and an over-long recording before it is transcribed", () => {
    expect(rejectUploadReason({ durationMs: 60_000, chunkCount: 2 })).toBeNull();
    expect(rejectUploadReason({ durationMs: 60_000, chunkCount: 3 })).toBe("count");
    expect(rejectUploadReason({ durationMs: 6 * 60_000, chunkCount: 0 })).toBe("duration");
  });
});
