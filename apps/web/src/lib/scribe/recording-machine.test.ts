import { describe, expect, it } from "vitest";
import { buttonEnabled, canTransition, transition } from "@/lib/scribe/recording-machine";

describe("recording state machine", () => {
  it("allows start, pause, resume, and stop", () => {
    expect(transition("idle", "requesting")).toBe("requesting");
    expect(transition("requesting", "live")).toBe("live");
    expect(transition("live", "paused")).toBe("paused");
    expect(transition("paused", "live")).toBe("live");
    expect(transition("live", "stopping")).toBe("stopping");
    expect(transition("stopping", "drafting")).toBe("drafting");
    expect(transition("drafting", "done")).toBe("done");
  });

  it("rejects a second start while a capture is already opening", () => {
    expect(canTransition("requesting", "requesting")).toBe(false);
    expect(() => transition("live", "requesting")).toThrow(/Cannot go from live to requesting/);
    expect(buttonEnabled("live").pause).toBe(true);
    expect(buttonEnabled("drafting").stop).toBe(false);
    expect(buttonEnabled("paused").resume).toBe(true);
  });
});
