export const CLIP_INTERVAL_MS = 15_000;

export type CutterState = "idle" | "recording" | "muted";
export type CutterEvent = "start" | "interval" | "pause" | "stop" | "mute" | "unmute" | "language";
export type CutterEffect = "begin" | "flush-and-begin" | "flush" | "drop" | "none";

export function reduceCutter(state: CutterState, event: CutterEvent): { state: CutterState; effect: CutterEffect } {
  if (event === "start" || event === "unmute") {
    if (state === "recording") return { state, effect: "none" };
    return { state: "recording", effect: "begin" };
  }
  if (event === "interval" || event === "language") {
    if (state !== "recording") return { state, effect: "none" };
    return { state: "recording", effect: "flush-and-begin" };
  }
  if (event === "pause" || event === "stop") {
    if (state !== "recording") return { state: "idle", effect: "none" };
    return { state: "idle", effect: "flush" };
  }
  if (event === "mute") {
    if (state !== "recording") return { state: "muted", effect: "none" };
    return { state: "muted", effect: "drop" };
  }
  return { state, effect: "none" };
}

export type FakeRecorder = { slices: number; flushed: number; dropped: number; recording: boolean };

/** Plays cutter events against a recorder that only counts slices. Used by tests. */
export function runClipCutter(events: CutterEvent[]) {
  let state: CutterState = "idle";
  const recorder: FakeRecorder = { slices: 0, flushed: 0, dropped: 0, recording: false };
  for (const event of events) {
    const next = reduceCutter(state, event);
    state = next.state;
    if (next.effect === "drop") {
      recorder.dropped += 1;
      recorder.recording = false;
    } else if (next.effect === "flush" || next.effect === "flush-and-begin") {
      recorder.flushed += 1;
      recorder.recording = false;
    }
    if (next.effect === "begin" || next.effect === "flush-and-begin") {
      recorder.slices += 1;
      recorder.recording = true;
    }
  }
  return { state, recorder };
}
