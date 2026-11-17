"use client";

import { useState } from "react";
import { nextMissing, SCRIBE_TOPICS, TOPIC_LABELS, topicHeard, type ScribeTopic } from "@/lib/scribe/coverage";
import type { ScribeCapture, ScribeLanguage, ScribeTextSize } from "@/components/use-scribe-capture";

const LANGUAGES: { id: ScribeLanguage; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "ta", label: "Tamil" },
  { id: "hi", label: "Hindi" },
  { id: "kn", label: "Kannada" },
  { id: "ml", label: "Malayalam" },
  { id: "en", label: "English" },
];

const TEXT_SIZES: { id: ScribeTextSize; label: string }[] = [
  { id: "sm", label: "A-" },
  { id: "md", label: "A" },
  { id: "lg", label: "A+" },
];

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function englishClass(size: ScribeTextSize) {
  if (size === "sm") return "text-sm";
  if (size === "lg") return "text-lg";
  return "text-base";
}

export function ConsultScribeDialog({ capture }: { capture: ScribeCapture }) {
  const [agreed, setAgreed] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  if (!capture.open) return null;

  const askNow = nextMissing(capture.coverage);
  const listening = capture.machine === "live" && !capture.muted;
  const showStart = capture.machine === "idle" || capture.machine === "error";
  const recording = capture.machine === "live" || capture.machine === "paused" || capture.machine === "requesting";
  const liveLine = (capture.interim || capture.english).trim().split("\n").filter(Boolean).pop() ?? "";
  const hasFields = SCRIBE_TOPICS.some((topic) => capture.fills[topic].trim());
  const status =
    capture.machine === "paused"
      ? "Paused"
      : capture.machine === "requesting"
        ? "Starting"
        : capture.machine === "stopping" || capture.machine === "drafting"
          ? "Filling"
          : capture.machine === "done"
            ? "Filled"
            : capture.machine === "error"
              ? "Check microphone"
              : capture.machine === "idle"
                ? "Record"
                : "Recording";

  if (capture.minimized) {
    return (
      <div className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-between gap-3 rounded-full border border-border bg-surface/95 px-3 py-2 shadow-card backdrop-blur">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm text-text-primary">
          <span className={`h-2 w-2 shrink-0 rounded-full ${listening ? "bg-critical" : "bg-text-secondary"}`} />
          <span className="truncate">{status}</span>
          <span className="font-mono text-xs tabular-nums text-text-secondary">{formatElapsed(capture.elapsedMs)}</span>
        </span>
        <span className="flex shrink-0 gap-1">
          <IconButton onClick={() => capture.setMinimized(false)}>Open</IconButton>
          <IconButton tone="primary" disabled={!capture.buttons.stop || capture.filling} onClick={capture.stopAndDraft}>
            Stop
          </IconButton>
        </span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-text-primary/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scribe-recording-title"
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-card sm:max-h-[88dvh] sm:rounded-3xl"
      >
        <header className="flex items-center gap-3 px-5 pt-4 pb-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${listening ? "animate-pulse bg-critical" : "bg-text-secondary/50"}`} />
          <h2 id="scribe-recording-title" className="text-sm font-medium text-text-primary">
            {status}
          </h2>
          <span className="font-mono text-xs tabular-nums text-text-secondary">{formatElapsed(capture.elapsedMs)}</span>
          {capture.stopsInMs != null ? (
            <span className="text-[11px] text-critical">Stops in {formatElapsed(capture.stopsInMs)}</span>
          ) : null}
          <button
            type="button"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-text-secondary hover:bg-app-bg"
            onClick={capture.dismiss}
            aria-label={recording ? "Minimize" : "Close"}
          >
            {recording ? "–" : "×"}
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
          {showStart ? (
            <div className="space-y-4 py-2">
              <p className="text-sm leading-relaxed text-text-secondary">
                Say the complaint, how long it has lasted, what you found, the diagnosis, each medicine with its dose, advice, and when to come back.
              </p>
              <label className="flex items-start gap-2.5 text-sm text-text-primary">
                <input type="checkbox" className="mt-0.5 accent-primary" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
                <span>Patient has agreed to this recording</span>
              </label>
              {capture.error ? <p className="text-sm text-critical">{capture.error}</p> : null}
              {capture.blocked ? (
                <button type="button" className="text-sm font-medium text-primary" onClick={capture.openSettings}>
                  Open Settings
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 py-1">
                <ListeningDots levels={capture.levels} active={listening} />
                <p className="text-[11px] text-text-secondary">
                  {capture.muted ? "Muted" : capture.machine === "paused" ? "Paused" : listening ? "Hearing you" : "Listening"}
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-app-bg px-3 py-2">
                <p aria-live="polite" className="min-w-0 flex-1 truncate text-xs text-text-secondary">
                  {liveLine || "Waiting for the first words"}
                </p>
                <button type="button" className="shrink-0 text-xs font-medium text-primary" onClick={() => setShowTranscript((open) => !open)}>
                  {showTranscript ? "Hide" : "Transcript"}
                </button>
              </div>

              {showTranscript ? (
                <div className="space-y-3 rounded-2xl border border-border px-3 py-3">
                  <div className="flex justify-end gap-1">
                    {TEXT_SIZES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`rounded-full px-2 py-0.5 text-[11px] ${item.id === capture.textSize ? "bg-primary text-white" : "text-text-secondary"}`}
                        onClick={() => capture.setTextSize(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className={`max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed text-text-primary ${englishClass(capture.textSize)}`}>
                    {capture.english.trim() || "Listening…"}
                    {capture.interim ? <span className="mt-1 block text-text-secondary">{capture.interim}</span> : null}
                  </div>
                  <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                    {capture.original.trim() || "Original words appear here."}
                  </p>
                </div>
              ) : null}

              {capture.fillMessage ? <p className="rounded-2xl bg-primary-light px-3 py-2 text-sm text-text-primary">{capture.fillMessage}</p> : null}
              {capture.liveUnavailable ? (
                <p className="text-xs leading-relaxed text-text-secondary">Live text is off. The recording is kept and written in when you stop.</p>
              ) : null}
              {capture.silenceAsk ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-app-bg px-3 py-2">
                  <p className="text-sm text-text-primary">No speech for a minute.</p>
                  <span className="flex gap-2">
                    <button type="button" className="text-sm font-medium text-primary" onClick={capture.dismissSilence}>
                      Continue
                    </button>
                    <button type="button" className="text-sm text-text-secondary" disabled={capture.filling} onClick={capture.stopAndDraft}>
                      Stop
                    </button>
                  </span>
                </div>
              ) : null}
              {capture.error ? <p className="text-sm text-critical">{capture.error}</p> : null}

              {capture.suggestions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium tracking-wide text-text-secondary uppercase">Did you mean</p>
                  <div className="flex flex-wrap gap-1.5">
                    {capture.suggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-primary hover:border-primary hover:bg-primary-light"
                        onClick={() => capture.chooseMedicine(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasFields || recording || capture.machine === "done" || capture.filling ? (
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {SCRIBE_TOPICS.map((topic) => (
                    <TopicRow
                      key={topic}
                      topic={topic}
                      text={capture.fills[topic]}
                      quote={capture.sources[topic]}
                      heard={topicHeard(capture.coverage, topic)}
                      current={askNow === topic && !capture.fills[topic].trim()}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="space-y-3 border-t border-border px-5 py-4">
          {showStart ? (
            <button
              type="button"
              className="h-11 w-full rounded-full bg-primary text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-40"
              disabled={!agreed || capture.machine === "requesting"}
              onClick={capture.start}
            >
              {capture.machine === "requesting" ? "Starting…" : "Start recording"}
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <ControlButton disabled={!capture.buttons.pause || capture.filling} onClick={capture.pause} active={capture.machine === "live"}>
                Pause
              </ControlButton>
              <button
                type="button"
                className="h-11 rounded-full bg-critical text-sm font-medium text-white disabled:opacity-40"
                disabled={!capture.buttons.stop || capture.filling}
                onClick={capture.stopAndDraft}
              >
                {capture.filling ? "Filling…" : "Stop"}
              </button>
              <ControlButton disabled={!capture.buttons.resume || capture.filling} onClick={capture.resume} active={capture.machine === "paused"}>
                Resume
              </ControlButton>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1 rounded-2xl bg-app-bg p-0.5">
              {LANGUAGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-[11px] ${item.id === capture.language ? "bg-surface font-medium text-text-primary shadow-sm" : "text-text-secondary"}`}
                  onClick={() => capture.chooseLanguage(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button type="button" className="text-text-secondary disabled:opacity-40" disabled={!capture.buttons.mute} onClick={capture.toggleMute}>
                {capture.muted ? "Unmute" : "Mute"}
              </button>
              <button type="button" className="text-text-secondary disabled:opacity-40" disabled={!capture.buttons.cancel || capture.filling} onClick={capture.cancel}>
                Discard
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ControlButton({
  children,
  disabled,
  onClick,
  active,
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-11 rounded-full text-sm font-medium disabled:opacity-40 ${active ? "bg-primary-light text-primary" : "bg-app-bg text-text-primary"}`}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  tone = "quiet",
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "quiet" | "primary";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-40 ${tone === "primary" ? "bg-primary text-white" : "text-text-primary"}`}
    >
      {children}
    </button>
  );
}

function ListeningDots({ levels, active }: { levels: number[]; active: boolean }) {
  const quiet = levels.every((level) => level < 0.04);
  return (
    <div className="flex h-8 items-center gap-1" aria-hidden="true">
      {levels.map((level, index) => {
        const height = active ? (quiet ? 6 + ((index * 3) % 10) : 4 + Math.round(level * 20)) : 4;
        return (
          <span
            key={index}
            className={`w-1 rounded-full ${active ? "bg-primary" : "bg-border"} ${active && quiet ? "animate-pulse" : ""}`}
            style={{ height, animationDelay: `${index * 80}ms` }}
          />
        );
      })}
    </div>
  );
}

function TopicRow({
  topic,
  text,
  quote,
  heard,
  current,
}: {
  topic: ScribeTopic;
  text: string;
  quote: string;
  heard: boolean;
  current: boolean;
}) {
  const [open, setOpen] = useState(false);
  const value = text.trim();
  const source = quote.trim();
  const long = value.length > 42 || value.includes("\n");
  const expandable = long || Boolean(source);
  const row = `group grid w-full grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 px-3 py-2.5 text-left ${current ? "bg-primary-light" : "bg-surface"}`;
  const valueClass = open
    ? "whitespace-pre-wrap"
    : "truncate [@media(hover:hover)]:group-hover:overflow-visible [@media(hover:hover)]:group-hover:text-clip [@media(hover:hover)]:group-hover:whitespace-pre-wrap";
  const body = (
    <>
      <p className={`text-xs ${value || heard ? "font-medium text-text-primary" : "text-text-secondary"}`}>{TOPIC_LABELS[topic]}</p>
      <p className={`text-sm ${value ? "text-text-primary" : "text-text-secondary/70"} ${valueClass}`}>{value || "—"}</p>
      {source ? (
        <p className={`col-start-2 text-[11px] leading-relaxed text-text-secondary ${open ? "" : "hidden [@media(hover:hover)]:group-hover:block"}`}>
          from: {source}
        </p>
      ) : null}
    </>
  );
  if (!expandable) return <div className={row}>{body}</div>;
  return (
    <button type="button" className={row} aria-expanded={open} onClick={() => setOpen((shown) => !shown)}>
      {body}
    </button>
  );
}
