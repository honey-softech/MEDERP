export const RECORDING_STATES = [
  "idle",
  "requesting",
  "live",
  "paused",
  "stopping",
  "drafting",
  "done",
  "error",
] as const;

export type RecordingState = (typeof RECORDING_STATES)[number];

const ALLOWED: Record<RecordingState, readonly RecordingState[]> = {
  idle: ["requesting"],
  requesting: ["live", "stopping", "error", "idle"],
  live: ["paused", "stopping", "idle", "error"],
  paused: ["live", "requesting", "stopping", "idle", "error"],
  stopping: ["drafting", "error", "idle"],
  drafting: ["done", "error"],
  done: ["idle", "requesting"],
  error: ["idle", "requesting", "stopping"],
};

export function canTransition(from: RecordingState, to: RecordingState) {
  return ALLOWED[from].includes(to);
}

/** Returns the next state. An illegal change throws so a double tap cannot open a second capture. */
export function transition(from: RecordingState, to: RecordingState): RecordingState {
  if (!canTransition(from, to)) {
    throw new Error(`Cannot go from ${from} to ${to}.`);
  }
  return to;
}

export function buttonEnabled(state: RecordingState) {
  return {
    pause: state === "live",
    resume: state === "paused",
    stop: state === "live" || state === "paused" || state === "error",
    cancel: state === "requesting" || state === "live" || state === "paused" || state === "error",
    mute: state === "live" || state === "paused",
    retry: state === "error" || state === "live" || state === "paused",
  };
}
