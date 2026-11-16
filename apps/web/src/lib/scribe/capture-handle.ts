export type CaptureTrack = {
  enabled: boolean;
  readyState: string;
  stop: () => void;
};

export type CaptureStream = {
  getTracks: () => CaptureTrack[];
  getAudioTracks?: () => CaptureTrack[];
};

export type CapturePeer = { close: () => void };
export type CaptureChannel = { close: () => void; send?: (data: string) => void; readyState?: string };
export type CaptureRecorder = { state: string; stop: () => void };
export type CaptureAudio = { close: () => void };

export type CaptureHandle = {
  readonly generation: number;
  readonly closed: boolean;
  readonly stream: CaptureStream;
  bind: (extra: { peer?: CapturePeer | null; channel?: CaptureChannel | null; recorder?: CaptureRecorder | null; audio?: CaptureAudio | null }) => void;
  trackTimer: (id: number) => void;
  send: (data: string) => boolean;
  pause: () => void;
  resume: () => void;
  stopRecorder: () => void;
  isCurrent: (generation: number) => boolean;
  close: () => boolean;
};

function safe(run: () => void) {
  try {
    run();
  } catch {
    // A resource that already closed should not keep the microphone open.
  }
}

/**
 * One owner for the microphone, the realtime connection, and the fallback recorder.
 * close() can run twice. A late event checks isCurrent and does nothing after close.
 */
export function createCaptureHandle(stream: CaptureStream, clearTimer: (id: number) => void = clearTimeout): CaptureHandle {
  let generation = 1;
  let closed = false;
  let peer: CapturePeer | null = null;
  let channel: CaptureChannel | null = null;
  let recorder: CaptureRecorder | null = null;
  let audio: CaptureAudio | null = null;
  const timers: number[] = [];

  function dropBound() {
    const currentPeer = peer;
    const currentChannel = channel;
    const currentRecorder = recorder;
    const currentAudio = audio;
    peer = null;
    channel = null;
    recorder = null;
    audio = null;
    if (currentRecorder && currentRecorder.state !== "inactive") safe(() => currentRecorder.stop());
    if (currentChannel) safe(() => currentChannel.close());
    if (currentPeer) safe(() => currentPeer.close());
    if (currentAudio) safe(() => currentAudio.close());
  }

  const handle: CaptureHandle = {
    get generation() {
      return generation;
    },
    get closed() {
      return closed;
    },
    stream,
    bind(extra) {
      if (closed) {
        if (extra.recorder && extra.recorder.state !== "inactive") safe(() => extra.recorder?.stop());
        safe(() => extra.channel?.close());
        safe(() => extra.peer?.close());
        safe(() => extra.audio?.close());
        return;
      }
      if (extra.peer && extra.peer !== peer) {
        if (peer) safe(() => peer?.close());
        peer = extra.peer;
      }
      if (extra.channel && extra.channel !== channel) {
        if (channel) safe(() => channel?.close());
        channel = extra.channel;
      }
      if (extra.recorder && extra.recorder !== recorder) {
        if (recorder && recorder.state !== "inactive") safe(() => recorder?.stop());
        recorder = extra.recorder;
      }
      if (extra.audio && extra.audio !== audio) {
        if (audio) safe(() => audio?.close());
        audio = extra.audio;
      }
    },
    trackTimer(id) {
      if (closed) {
        clearTimer(id);
        return;
      }
      timers.push(id);
    },
    send(data) {
      if (closed || !channel?.send || channel.readyState === "closed") return false;
      try {
        channel.send(data);
        return true;
      } catch {
        return false;
      }
    },
    pause() {
      if (closed) return;
      for (const track of stream.getTracks()) track.enabled = false;
    },
    resume() {
      if (closed) return;
      for (const track of stream.getTracks()) track.enabled = true;
    },
    stopRecorder() {
      if (closed || !recorder) return;
      const current = recorder;
      recorder = null;
      if (current.state !== "inactive") safe(() => current.stop());
    },
    isCurrent(seen) {
      return !closed && seen === generation;
    },
    close() {
      if (!closed) {
        closed = true;
        generation += 1;
        dropBound();
        for (const track of stream.getTracks()) safe(() => track.stop());
        for (const id of timers) clearTimer(id);
        timers.length = 0;
      }
      const tracks = stream.getTracks();
      return tracks.length > 0 && tracks.every((track) => track.readyState === "ended");
    },
  };

  return handle;
}
