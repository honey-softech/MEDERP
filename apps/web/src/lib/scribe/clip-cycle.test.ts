import { describe, expect, it } from "vitest";
import { reduceCutter, runClipCutter } from "@/lib/scribe/clip-cycle";

describe("clip cutter", () => {
  it("starts a slice, cuts it, and starts the next one", () => {
    const run = runClipCutter(["start", "interval"]);
    expect(run.state).toBe("recording");
    expect(run.recorder.slices).toBe(2);
    expect(run.recorder.flushed).toBe(1);
    expect(run.recorder.recording).toBe(true);
  });

  it("flushes the open slice on pause and on stop", () => {
    const paused = runClipCutter(["start", "pause"]);
    expect(paused.state).toBe("idle");
    expect(paused.recorder.flushed).toBe(1);
    expect(paused.recorder.recording).toBe(false);

    const stopped = runClipCutter(["start", "interval", "stop"]);
    expect(stopped.state).toBe("idle");
    expect(stopped.recorder.slices).toBe(2);
    expect(stopped.recorder.flushed).toBe(2);
    expect(stopped.recorder.recording).toBe(false);
  });

  it("drops the open slice on mute and starts a new one on unmute", () => {
    const muted = runClipCutter(["start", "mute"]);
    expect(muted.state).toBe("muted");
    expect(muted.recorder.dropped).toBe(1);
    expect(muted.recorder.flushed).toBe(0);

    const resumed = runClipCutter(["start", "mute", "unmute"]);
    expect(resumed.state).toBe("recording");
    expect(resumed.recorder.slices).toBe(2);
    expect(resumed.recorder.recording).toBe(true);
  });

  it("flushes and restarts when the language changes", () => {
    expect(reduceCutter("recording", "language")).toEqual({ state: "recording", effect: "flush-and-begin" });
    expect(reduceCutter("idle", "language")).toEqual({ state: "idle", effect: "none" });
    expect(reduceCutter("muted", "stop")).toEqual({ state: "idle", effect: "none" });
  });
});
