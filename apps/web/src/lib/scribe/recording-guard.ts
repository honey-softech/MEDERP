import {
  SCRIBE_MAX_CHUNKS,
  SCRIBE_MAX_RECORDING_MS,
  SCRIBE_RECORDING_SLACK_MS,
  SCRIBE_SILENCE_ANSWER_MS,
  SCRIBE_SILENCE_MS,
  SPEECH_RMS,
} from "@/lib/scribe/limits";

export function recordingLimitReached(elapsedMs: number) {
  return elapsedMs >= SCRIBE_MAX_RECORDING_MS;
}

export function silencePromptDue(silentMs: number, promptOpen: boolean) {
  return !promptOpen && silentMs >= SCRIBE_SILENCE_MS;
}

export function silencePromptExpired(waitingMs: number) {
  return waitingMs >= SCRIBE_SILENCE_ANSWER_MS;
}

export function uploadDurationAllowed(durationMs: number) {
  return Number.isFinite(durationMs) && durationMs >= 0 && durationMs <= SCRIBE_MAX_RECORDING_MS + SCRIBE_RECORDING_SLACK_MS;
}

export function rejectUploadReason(input: { durationMs: number; chunkCount: number }) {
  if (!uploadDurationAllowed(input.durationMs)) return "duration" as const;
  if (input.chunkCount >= SCRIBE_MAX_CHUNKS) return "count" as const;
  return null;
}

export function isSpeechLevel(rms: number) {
  return rms >= SPEECH_RMS;
}

/** Samples are unsigned 8-bit microphone levels, 128 at silence. */
export function rmsFromSamples(samples: ArrayLike<number>) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index++) {
    const centered = ((samples[index] ?? 128) - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / samples.length);
}
