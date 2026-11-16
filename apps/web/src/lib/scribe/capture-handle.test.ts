import { describe, expect, it } from "vitest";
import { createCaptureHandle, type CaptureTrack } from "@/lib/scribe/capture-handle";

function fakeTrack(): CaptureTrack {
  return {
    enabled: true,
    readyState: "live",
    stop() {
      this.readyState = "ended";
      this.enabled = false;
    },
  };
}

describe("capture handle", () => {
  it("stops every track once and ignores a second close", () => {
    const track = fakeTrack();
    let stops = 0;
    const original = track.stop.bind(track);
    track.stop = () => {
      stops += 1;
      original();
    };
    const handle = createCaptureHandle({ getTracks: () => [track] });
    expect(handle.close()).toBe(true);
    expect(handle.close()).toBe(true);
    expect(stops).toBe(1);
    expect(handle.closed).toBe(true);
    expect(handle.isCurrent(1)).toBe(false);
  });

  it("stops the recorder without ending the microphone", () => {
    const track = fakeTrack();
    let stopped = 0;
    const handle = createCaptureHandle({ getTracks: () => [track] });
    handle.bind({
      recorder: {
        state: "recording",
        stop() {
          stopped += 1;
          this.state = "inactive";
        },
      },
    });
    handle.stopRecorder();
    handle.stopRecorder();
    expect(stopped).toBe(1);
    expect(track.readyState).toBe("live");
  });

  it("pauses by disabling the track and resumes without a new request", () => {
    const track = fakeTrack();
    const handle = createCaptureHandle({ getTracks: () => [track] });
    handle.pause();
    expect(track.enabled).toBe(false);
    expect(track.readyState).toBe("live");
    handle.resume();
    expect(track.enabled).toBe(true);
  });

  it("closes a connection that arrives after the capture was stopped", () => {
    const track = fakeTrack();
    const handle = createCaptureHandle({ getTracks: () => [track] });
    handle.close();
    let closed = false;
    handle.bind({ peer: { close: () => { closed = true; } } });
    expect(closed).toBe(true);
  });

  it("drops a timer when the capture closes", () => {
    const cleared: number[] = [];
    const track = fakeTrack();
    const handle = createCaptureHandle({ getTracks: () => [track] }, (id) => {
      cleared.push(id);
    });
    handle.trackTimer(7);
    handle.close();
    expect(cleared).toEqual([7]);
  });
});
