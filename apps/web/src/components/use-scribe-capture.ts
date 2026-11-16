"use client";

import { useEffect, useRef, useState } from "react";
import {
  SCRIBE_ASSESSMENT_KEYS,
  draftToAssessment,
  fieldsToCheck,
  medicineChoicesFromDraft,
  type ScribeAssessmentKey,
  type ScribeAssessmentPatch,
  type ScribeDraft,
} from "@/lib/scribe/draft-schema";
import { createCaptureHandle, type CaptureHandle } from "@/lib/scribe/capture-handle";
import { coverText, emptyCoverage, markAsked, type ScribeTopic } from "@/lib/scribe/coverage";
import { withoutPromptEcho } from "@/lib/scribe/medicine-match";
import { SCRIBE_MAX_RECORDING_MS } from "@/lib/scribe/limits";
import { openInstalledSettings, runningInInstalledApp } from "@/lib/native-app-session";
import { buttonEnabled, canTransition, type RecordingState } from "@/lib/scribe/recording-machine";
import { recordingLimitReached, silencePromptDue, silencePromptExpired } from "@/lib/scribe/recording-guard";
import {
  appendInterimDelta,
  commitSegment,
  createTranscriptStore,
  seedTranscript,
  type TranscriptStore,
} from "@/lib/scribe/transcript-store";

export type ScribeSessionStatus = "RECORDING" | "TRANSCRIBED" | "DRAFTED" | "APPLIED" | "DISCARDED";

export type ScribeSessionView = {
  id: string;
  status: ScribeSessionStatus;
  transcript: string;
  translation: string;
  draft: ScribeDraft | null;
  chunkCount: number;
  consentAt: string;
  updatedAt: string;
};

export type ScribeLanguage = "auto" | "en" | "ta" | "hi";
export type ScribeTextSize = "sm" | "md" | "lg";

type Options = {
  appointmentId: string;
  onSession?: (session: ScribeSessionView | null) => void;
  onApply?: (patch: ScribeAssessmentPatch, uncertain: ScribeAssessmentKey[], choices?: Record<string, string[]>) => void;
};

const ZERO_LEVELS = [0, 0, 0, 0, 0, 0, 0, 0];

function clock() {
  return Date.now();
}

function emptyFills(): Record<ScribeTopic, string> {
  return {
    chiefComplaint: "",
    history: "",
    examination: "",
    diagnosis: "",
    medicines: "",
    advice: "",
    followUp: "",
  };
}

function fillsFromDraft(draft: ScribeDraft): Record<ScribeTopic, string> {
  const values = draftToAssessment(draft);
  const outcome = values.visitOutcome === "DISCHARGE" ? "Discharged" : values.visitOutcome === "FOLLOW_UP" ? "Follow up" : "";
  return {
    chiefComplaint: values.chiefComplaint,
    history: values.summary,
    examination: values.examination,
    diagnosis: values.diagnosis,
    medicines: values.prescription,
    advice: values.advice,
    followUp: [outcome, values.followUpAt].filter(Boolean).join(" · "),
  };
}

function appleTouchDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function mimeChoices() {
  const ordered = appleTouchDevice()
    ? ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined") return [""];
  const supported = ordered.filter((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
  return [...supported, ""];
}

function openRecorder(stream: MediaStream) {
  let last: unknown = new Error("Could not start recording.");
  for (const mime of mimeChoices()) {
    try {
      return mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

function storedMime(mime: string) {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "video/mp4" || base === "audio/m4a" || base === "audio/x-m4a") return "audio/mp4";
  if (base === "video/webm") return "audio/webm";
  return base || "audio/webm";
}

function openMicrophone() {
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("This browser cannot record audio."));
  }
  const plain = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
  return navigator.mediaDevices.getUserMedia({ audio: true }).catch((error: unknown) => {
    if (
      error instanceof DOMException &&
      (error.name === "NotReadableError" || error.name === "OverconstrainedError" || error.name === "AbortError")
    ) {
      return navigator.mediaDevices.getUserMedia(plain);
    }
    throw error;
  });
}

function micMessage(error: unknown) {
  if (error instanceof Error && error.message.startsWith("This browser")) return error.message;
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    if (runningInInstalledApp()) return "The microphone is off for MedERP. Turn it on in Settings, then record again.";
    if (appleTouchDevice()) return "Allow the microphone for mederp.co.in in Safari, then record again.";
    return "Allow the microphone to record the consultation.";
  }
  if (name === "NotFoundError") return "No microphone was found on this device.";
  if (name === "NotReadableError") return "The microphone is being used by another app. Close that app and try again.";
  if (name === "NotSupportedError") return "Could not start recording on this device.";
  return "Could not use the microphone.";
}

function micBlocked(error: unknown) {
  return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
}

function languagePayload(language: ScribeLanguage) {
  const transcription: { model: string; prompt: string; language?: string } = {
    model: "gpt-4o-transcribe",
    prompt: "Transcribe only the words spoken. Do not add symptoms, medicines, or doses. thalavali means headache.",
  };
  if (language !== "auto") transcription.language = language;
  return {
    type: "session.update",
    session: {
      type: "transcription",
      audio: { input: { transcription } },
    },
  };
}

export function useScribeCapture({ appointmentId, onSession, onApply }: Options) {
  const [machine, setMachine] = useState<RecordingState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [liveUnavailable, setLiveUnavailable] = useState(false);
  const [interim, setInterim] = useState("");
  const [original, setOriginal] = useState("");
  const [english, setEnglish] = useState("");
  const [coverage, setCoverage] = useState(0);
  const [silenceAsk, setSilenceAsk] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [textSize, setTextSize] = useState<ScribeTextSize>("md");
  const [language, setLanguageState] = useState<ScribeLanguage>("auto");
  const [minimized, setMinimized] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [levels, setLevels] = useState<number[]>(ZERO_LEVELS);
  const [fills, setFills] = useState<Record<ScribeTopic, string>>(emptyFills);
  const [fillMessage, setFillMessage] = useState("");

  const machineRef = useRef<RecordingState>("idle");
  const storeRef = useRef<TranscriptStore>(createTranscriptStore());
  const coverageRef = useRef(0);
  const handleRef = useRef<CaptureHandle | null>(null);
  const runRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const seqRef = useRef(1);
  const languageRef = useRef<ScribeLanguage>("auto");
  const mutedRef = useRef(false);
  const lastSpeechRef = useRef(0);
  const silenceAskRef = useRef(false);
  const silenceAskedAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const accumRef = useRef(0);
  const pauseBeganRef = useRef(0);
  const fallbackBlobRef = useRef<Promise<Blob> | null>(null);
  const pendingRef = useRef<{ itemId: string; text: string } | null>(null);
  const failedBlobRef = useRef<Blob | null>(null);
  const onSessionRef = useRef(onSession);
  const onApplyRef = useRef(onApply);
  const stopRef = useRef<() => void>(() => {});
  const previewAtRef = useRef(0);
  const previewCountRef = useRef(0);
  const previewBusyRef = useRef(false);
  const previewTimerRef = useRef(0);

  function go(to: RecordingState) {
    if (!canTransition(machineRef.current, to)) return false;
    machineRef.current = to;
    setMachine(to);
    return true;
  }

  function publishTranscript() {
    const store = storeRef.current;
    setOriginal(store.original);
    setEnglish(store.english);
    setInterim(store.interim);
  }

  function publishCoverage(mask: number) {
    coverageRef.current = mask;
    setCoverage(mask);
  }

  function resetNote() {
    storeRef.current = createTranscriptStore();
    publishTranscript();
    publishCoverage(emptyCoverage());
    pendingRef.current = null;
    failedBlobRef.current = null;
    setSuggestions([]);
    setLevels(ZERO_LEVELS);
    setFills(emptyFills());
    setFillMessage("");
    previewAtRef.current = 0;
    previewCountRef.current = 0;
    window.clearTimeout(previewTimerRef.current);
    fallbackBlobRef.current = null;
    seqRef.current = 1;
    startedAtRef.current = 0;
    accumRef.current = 0;
    pauseBeganRef.current = 0;
    setElapsedMs(0);
    setSpeaking(false);
    setLiveUnavailable(false);
  }

  function adoptSession(session: ScribeSessionView) {
    const changed = session.id !== sessionIdRef.current;
    sessionIdRef.current = session.id;
    seqRef.current = Math.max(seqRef.current, (session.chunkCount ?? 0) + 1);
    if (changed) {
      storeRef.current = createTranscriptStore();
      seedTranscript(storeRef.current, session.transcript ?? "", session.translation ?? "");
      publishTranscript();
      publishCoverage(coverText(emptyCoverage(), `${session.transcript ?? ""}\n${session.translation ?? ""}`));
    }
    onSessionRef.current?.(session);
  }

  async function ensureSession() {
    const response = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", consent: true }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; session?: ScribeSessionView };
    if (!response.ok || !data.session) return { error: data.error ?? "Could not start the recording." };
    return { session: data.session };
  }

  async function postSegment(itemId: string, text: string) {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return false;
    if (storeRef.current.byId.has(itemId)) return true;
    const seq = seqRef.current;
    const response = await fetch(`/api/appointments/${appointmentId}/scribe/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, seq, text }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      english?: string;
      chunkCount?: number;
      suggestions?: string[];
      session?: ScribeSessionView;
    };
    if (!response.ok) {
      if (response.status === 409 && typeof data.chunkCount === "number") seqRef.current = data.chunkCount + 1;
      pendingRef.current = { itemId, text };
      setError(data.error ?? "Could not save that line of the conversation.");
      return false;
    }
    pendingRef.current = null;
    if (typeof data.chunkCount === "number") seqRef.current = data.chunkCount + 1;
    const englishLine = (data.english || text).trim();
    commitSegment(storeRef.current, { id: itemId, seq, original: text, english: englishLine });
    publishTranscript();
    publishCoverage(coverText(coverageRef.current, `${text}\n${englishLine}`));
    if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions.slice(0, 6));
    if (data.session) onSessionRef.current?.(data.session);
    scheduleAutoPreview();
    return true;
  }

  function onRealtimeEvent(raw: string) {
    let event: { type?: string; delta?: string; transcript?: string; item_id?: string };
    try {
      event = JSON.parse(raw) as typeof event;
    } catch {
      return;
    }
    if (event.type === "input_audio_buffer.speech_started") {
      setSpeaking(true);
      lastSpeechRef.current = Date.now();
      silenceAskRef.current = false;
      setSilenceAsk(false);
      return;
    }
    if (event.type === "input_audio_buffer.speech_stopped") {
      setSpeaking(false);
      lastSpeechRef.current = Date.now();
      return;
    }
    if (event.type === "conversation.item.input_audio_transcription.delta" && event.item_id && event.delta) {
      appendInterimDelta(storeRef.current, event.item_id, event.delta);
      storeRef.current.interim = withoutPromptEcho(storeRef.current.interim);
      setInterim(storeRef.current.interim);
      setSpeaking(true);
      lastSpeechRef.current = clock();
      return;
    }
    if (event.type === "conversation.item.input_audio_transcription.completed" && event.item_id) {
      const text = withoutPromptEcho(event.transcript ?? storeRef.current.interim);
      if (text) void postSegment(event.item_id, text);
      else {
        storeRef.current.interim = "";
        storeRef.current.interimId = null;
        setInterim("");
      }
    }
  }

  async function openRealtime(handle: CaptureHandle) {
    const seen = handle.generation;
    const sessionId = sessionIdRef.current;
    if (!sessionId) return false;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    try {
      const stream = handle.stream as MediaStream;
      for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
      const channel = pc.createDataChannel("oai-events");
      handle.bind({ peer: pc, channel });
      channel.addEventListener("message", (event) => {
        if (!handle.isCurrent(seen)) return;
        onRealtimeEvent(String(event.data));
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (pc.iceGatheringState !== "complete") {
        await new Promise<void>((resolve) => {
          const finish = () => {
            pc.removeEventListener("icegatheringstatechange", onState);
            window.clearTimeout(timer);
            resolve();
          };
          const onState = () => {
            if (pc.iceGatheringState === "complete") finish();
          };
          const timer = window.setTimeout(finish, 2500);
          pc.addEventListener("icegatheringstatechange", onState);
        });
      }
      const response = await fetch(`/api/appointments/${appointmentId}/scribe/realtime-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sdp: pc.localDescription?.sdp ?? offer.sdp ?? "",
          language: languageRef.current,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { sdp?: string };
      if (!response.ok || !data.sdp || !handle.isCurrent(seen)) {
        pc.close();
        return false;
      }
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      if (!handle.isCurrent(seen)) {
        pc.close();
        return false;
      }
      handle.send(JSON.stringify(languagePayload(languageRef.current)));
      return true;
    } catch {
      pc.close();
      return false;
    }
  }

  function startFallback(handle: CaptureHandle) {
    const stream = handle.stream as MediaStream;
    const recorder = openRecorder(stream);
    const parts: Blob[] = [];
    fallbackBlobRef.current = new Promise((resolve) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) parts.push(event.data);
      };
      recorder.onstop = () => resolve(new Blob(parts, { type: storedMime(recorder.mimeType) }));
    });
    recorder.start();
    handle.bind({ recorder });
  }

  async function uploadBlob(blob: Blob) {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return false;
    const seq = seqRef.current;
    const body = new FormData();
    const type = storedMime(blob.type);
    body.set("audio", new Blob([blob], { type }), type === "audio/mp4" ? "consult.m4a" : "consult.webm");
    body.set("sessionId", sessionId);
    body.set("seq", String(seq));
    if (seq <= 1) body.set("mode", "replace");
    body.set("durationMs", String(Math.max(0, Date.now() - (startedAtRef.current || Date.now()))));
    const response = await fetch(`/api/appointments/${appointmentId}/scribe/transcribe`, { method: "POST", body });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      transcript?: string;
      translation?: string;
      chunkCount?: number;
      session?: ScribeSessionView;
    };
    if (!response.ok) {
      setError(data.error ?? "Could not save the recording.");
      return false;
    }
    if (typeof data.chunkCount === "number") seqRef.current = data.chunkCount + 1;
    storeRef.current = createTranscriptStore();
    seedTranscript(storeRef.current, data.transcript ?? "", data.session?.translation ?? data.translation ?? "");
    publishTranscript();
    publishCoverage(coverText(emptyCoverage(), `${storeRef.current.original}\n${storeRef.current.english}`));
    if (data.session) onSessionRef.current?.(data.session);
    failedBlobRef.current = null;
    return true;
  }

  async function draftAndApply() {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      setError("No recording was found for this visit.");
      go("error");
      return;
    }
    const response = await fetch(`/api/appointments/${appointmentId}/scribe/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; session?: ScribeSessionView };
    if (!response.ok || !data.session) {
      const message = data.error ?? "Could not draft the visit note.";
      setFillMessage(message);
      setError(message);
      go("error");
      return;
    }
    onSessionRef.current?.(data.session);
    const draft = data.session.draft;
    if (!draft) {
      const message = "Nothing clear was heard. Say the complaint, then each medicine with the dose.";
      setFillMessage(message);
      setError(message);
      go("error");
      return;
    }
    const values = draftToAssessment(draft);
    const patch: ScribeAssessmentPatch = {};
    for (const key of SCRIBE_ASSESSMENT_KEYS) {
      if (values[key].trim()) patch[key] = values[key];
    }
    if (Object.keys(patch).length === 0) {
      const message = "Nothing clear was heard. Say the complaint, then each medicine with the dose.";
      setFillMessage(message);
      setError(message);
      go("error");
      return;
    }
    const applied = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "applied", sessionId, draft }),
    });
    const appliedData = (await applied.json().catch(() => ({}))) as { error?: string; session?: ScribeSessionView };
    if (!applied.ok || !appliedData.session) {
      const message = appliedData.error ?? "Could not fill the assessment.";
      setFillMessage(message);
      setError(message);
      go("error");
      return;
    }
    onSessionRef.current?.(appliedData.session);
    onApplyRef.current?.(patch, fieldsToCheck(draft), medicineChoicesFromDraft(draft));
    setFills(fillsFromDraft(draft));
    setFillMessage("Filled the assessment. Check the note, then Approve.");
    go("done");
  }

  async function connect(micReady: Promise<MediaStream | unknown>, run: number) {
    try {
      const [mic, opened] = await Promise.all([micReady, ensureSession()]);
      if (runRef.current !== run) {
        if (mic instanceof MediaStream) mic.getTracks().forEach((track) => track.stop());
        return;
      }
      if ("error" in opened) {
        if (mic instanceof MediaStream) mic.getTracks().forEach((track) => track.stop());
        setError(opened.error ?? "Could not start the recording.");
        setBlocked(false);
        go("error");
        return;
      }
      if (!(mic instanceof MediaStream)) {
        setError(micMessage(mic));
        setBlocked(micBlocked(mic));
        go("error");
        return;
      }
      adoptSession(opened.session);
      const handle = createCaptureHandle(mic, (id) => {
        window.clearTimeout(id);
        window.clearInterval(id);
      });
      handleRef.current = handle;
      watchLevels(handle);
      if (runRef.current !== run) {
        handle.close();
        return;
      }
      let live = false;
      if (runRef.current === run) live = await openRealtime(handle);
      if (!handle.isCurrent(handle.generation) || runRef.current !== run) return;
      if (!live) {
        try {
          startFallback(handle);
          setLiveUnavailable(true);
        } catch {
          handle.close();
          setError("Could not start recording on this device.");
          go("error");
          return;
        }
      } else {
        setLiveUnavailable(false);
      }
      lastSpeechRef.current = clock();
      if (!startedAtRef.current) startedAtRef.current = clock();
      if (!go("live")) handle.close();
    } catch (reason) {
      if (runRef.current !== run) return;
      handleRef.current?.close();
      setError(micMessage(reason));
      setBlocked(micBlocked(reason));
      go("error");
    }
  }

  function start() {
    const from = machineRef.current;
    if (from === "paused" && handleRef.current && !handleRef.current.closed) {
      handleRef.current.resume();
      if (liveUnavailable && !fallbackBlobRef.current) startFallback(handleRef.current);
      mutedRef.current = false;
      setMuted(false);
      setFillMessage("");
      go("live");
      return;
    }
    if (!canTransition(from, "requesting")) return;
    const run = ++runRef.current;
    if (from !== "paused") resetNote();
    setError("");
    setBlocked(false);
    setMinimized(false);
    setOpen(true);
    machineRef.current = "requesting";
    setMachine("requesting");
    handleRef.current?.close();
    handleRef.current = null;
    const micReady = openMicrophone().then(
      (stream) => stream,
      (reason: unknown) => reason,
    );
    void connect(micReady, run);
  }

  function watchLevels(handle: CaptureHandle) {
    if (appleTouchDevice() || typeof AudioContext === "undefined") return;
    const stream = handle.stream as MediaStream;
    if (typeof stream.getAudioTracks !== "function") return;
    let audio: AudioContext;
    try {
      audio = new AudioContext();
    } catch {
      return;
    }
    const source = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const bins = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      if (now - last < 80) return;
      last = now;
      if (handle.closed || machineRef.current !== "live") return;
      analyser.getByteTimeDomainData(bins);
      const next = ZERO_LEVELS.map((_, index) => {
        const start = Math.floor((index * bins.length) / ZERO_LEVELS.length);
        const end = Math.floor(((index + 1) * bins.length) / ZERO_LEVELS.length);
        let sum = 0;
        for (let i = start; i < end; i++) {
          const sample = ((bins[i] ?? 128) - 128) / 128;
          sum += sample * sample;
        }
        return Math.min(1, Math.sqrt(sum / Math.max(1, end - start)) * 12);
      });
      setLevels(next);
      const loud = next.some((level) => level > 0.08);
      setSpeaking((current) => (current === loud ? current : loud));
    };
    void audio.resume().catch(() => undefined);
    frame = window.requestAnimationFrame(tick);
    handle.bind({
      audio: {
        close() {
          window.cancelAnimationFrame(frame);
          try {
            source.disconnect();
          } catch {
            // The source is already closed with the microphone.
          }
          void audio.close();
        },
      },
    });
  }

  function showDraft(draft: ScribeDraft) {
    setFills(fillsFromDraft(draft));
    const values = draftToAssessment(draft);
    const patch: ScribeAssessmentPatch = {};
    for (const key of SCRIBE_ASSESSMENT_KEYS) {
      if (values[key].trim()) patch[key] = values[key];
    }
    if (Object.keys(patch).length > 0) onApplyRef.current?.(patch, fieldsToCheck(draft), medicineChoicesFromDraft(draft));
  }

  function scheduleAutoPreview() {
    if (previewCountRef.current >= 6 || previewBusyRef.current) return;
    const heard = `${storeRef.current.english}\n${storeRef.current.original}`.trim();
    if (heard.length < 24) return;
    window.clearTimeout(previewTimerRef.current);
    const wait = Math.max(0, 25_000 - (clock() - previewAtRef.current));
    previewTimerRef.current = window.setTimeout(() => {
      if (machineRef.current !== "live" && machineRef.current !== "paused") return;
      void previewFields("auto");
    }, wait);
  }

  async function previewFields(mode: "pause" | "auto") {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      if (mode === "pause") setFillMessage("Nothing was heard yet.");
      return;
    }
    if (mode === "auto" && (previewCountRef.current >= 6 || previewBusyRef.current)) return;
    previewBusyRef.current = true;
    previewAtRef.current = clock();
    if (mode === "auto") previewCountRef.current += 1;
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/scribe/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, preview: true }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; session?: ScribeSessionView };
      if (!response.ok || !data.session?.draft) {
        if (mode === "pause") setFillMessage(data.error ?? "Could not read the fields yet. Keep speaking, then pause again.");
        return;
      }
      showDraft(data.session.draft);
      if (mode === "pause") setFillMessage("Paused. These are the fields heard so far.");
      onSessionRef.current?.(data.session);
    } finally {
      previewBusyRef.current = false;
    }
  }

  async function sendPausedAndRead() {
    setFillMessage("Reading what you said…");
    const handle = handleRef.current;
    const blobPromise = fallbackBlobRef.current;
    if (handle && blobPromise) {
      fallbackBlobRef.current = null;
      handle.stopRecorder();
      const blob = await Promise.race([
        blobPromise,
        new Promise<Blob>((resolve) => {
          window.setTimeout(() => resolve(new Blob()), 4_000);
        }),
      ]);
      if (blob.size > 0 && !(await uploadBlob(blob))) {
        failedBlobRef.current = blob;
        setFillMessage("Could not send that part of the recording.");
        return;
      }
    }
    await previewFields("pause");
  }

  function pause() {
    if (!go("paused")) return;
    handleRef.current?.pause();
    if (!pauseBeganRef.current) pauseBeganRef.current = Date.now();
    setSpeaking(false);
    setLevels(ZERO_LEVELS);
    void sendPausedAndRead();
  }

  function resume() {
    start();
  }

  function present() {
    setMinimized(false);
    setOpen(true);
  }

  function dismiss() {
    const state = machineRef.current;
    if (state === "live" || state === "paused" || state === "requesting" || state === "stopping" || state === "drafting") {
      setMinimized(true);
      return;
    }
    setOpen(false);
  }

  async function stopAndDraft() {
    if (!canTransition(machineRef.current, "stopping")) return;
    runRef.current += 1;
    go("stopping");
    setFillMessage("Filling the assessment…");
    silenceAskRef.current = false;
    setSilenceAsk(false);
    setSpeaking(false);
    const handle = handleRef.current;
    const blobPromise = fallbackBlobRef.current;
    fallbackBlobRef.current = null;
    handle?.close();
    handleRef.current = null;
    try {
      const savedBlob = failedBlobRef.current;
      if (blobPromise) {
        const blob = await Promise.race([
          blobPromise,
          new Promise<Blob>((resolve) => {
            window.setTimeout(() => resolve(new Blob()), 4_000);
          }),
        ]);
        if (blob.size > 0 && !(await uploadBlob(blob))) {
          failedBlobRef.current = blob;
          go("error");
          return;
        }
      } else if (savedBlob && !(await uploadBlob(savedBlob))) {
        go("error");
        return;
      }
      const pending = pendingRef.current;
      if (pending && !(await postSegment(pending.itemId, pending.text))) {
        go("error");
        return;
      }
      if (!go("drafting")) return;
      await draftAndApply();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not draft the visit note.");
      go("error");
    }
  }
  useEffect(() => {
    onSessionRef.current = onSession;
    onApplyRef.current = onApply;
    stopRef.current = () => {
      void stopAndDraft();
    };
  });

  async function cancel() {
    if (!canTransition(machineRef.current, "idle")) return;
    runRef.current += 1;
    handleRef.current?.close();
    handleRef.current = null;
    fallbackBlobRef.current = null;
    const sessionId = sessionIdRef.current;
    go("idle");
    setOpen(false);
    setSpeaking(false);
    if (!sessionId) return;
    const response = await fetch(`/api/appointments/${appointmentId}/scribe/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "discard", sessionId }),
    });
    if (response.ok) {
      sessionIdRef.current = null;
      onSessionRef.current?.(null);
    }
  }

  function toggleMute() {
    const handle = handleRef.current;
    if (!handle || handle.closed) return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) handle.pause();
    else handle.resume();
  }

  function retry() {
    if (pendingRef.current) {
      const pending = pendingRef.current;
      void postSegment(pending.itemId, pending.text);
      return;
    }
    if (failedBlobRef.current) {
      const blob = failedBlobRef.current;
      void uploadBlob(blob);
      return;
    }
    const handle = handleRef.current;
    if (handle && !handle.closed && (machineRef.current === "live" || machineRef.current === "paused")) {
      void (async () => {
        const ok = await openRealtime(handle);
        setLiveUnavailable(!ok);
        if (!ok) setError("Live text is still unavailable. The note is written when you stop.");
        else setError("");
      })();
      return;
    }
    start();
  }

  function chooseLanguage(next: ScribeLanguage) {
    languageRef.current = next;
    setLanguageState(next);
    handleRef.current?.send(JSON.stringify(languagePayload(next)));
  }

  function chooseMedicine(name: string) {
    const chosen = name.trim();
    if (!chosen) return;
    setSuggestions((current) => current.filter((item) => item !== chosen));
    void postSegment(`choice-${chosen.toLowerCase()}`, `Medicine: ${chosen}`);
  }

  function askTopic(topic: ScribeTopic) {
    publishCoverage(markAsked(coverageRef.current, topic));
  }

  async function copyTranscript() {
    const text = (storeRef.current.english || storeRef.current.original).trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Could not copy the transcript.");
    }
  }

  function dismissSilence() {
    silenceAskRef.current = false;
    silenceAskedAtRef.current = 0;
    lastSpeechRef.current = Date.now();
    setSilenceAsk(false);
  }

  useEffect(() => {
    if (machine !== "live") {
      if (machine === "paused" && !pauseBeganRef.current) pauseBeganRef.current = Date.now();
      return;
    }
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    if (pauseBeganRef.current) {
      accumRef.current += Date.now() - pauseBeganRef.current;
      pauseBeganRef.current = 0;
    }
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current - accumRef.current;
      setElapsedMs(elapsed);
      if (recordingLimitReached(elapsed)) {
        stopRef.current();
        return;
      }
      if (silenceAskRef.current) {
        if (silencePromptExpired(Date.now() - silenceAskedAtRef.current)) stopRef.current();
        return;
      }
      if (silencePromptDue(Date.now() - lastSpeechRef.current, false)) {
        silenceAskRef.current = true;
        silenceAskedAtRef.current = Date.now();
        setSilenceAsk(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [machine]);

  useEffect(() => {
    if (!open) return;
    function release() {
      const state = machineRef.current;
      if (state !== "live" && state !== "paused" && state !== "requesting") return;
      runRef.current += 1;
      handleRef.current?.close();
      handleRef.current = null;
      fallbackBlobRef.current = null;
      if (canTransition(machineRef.current, "paused")) go("paused");
      else if (canTransition(machineRef.current, "idle")) {
        go("idle");
        setOpen(false);
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") release();
    }
    window.addEventListener("pagehide", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", release);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      window.clearTimeout(previewTimerRef.current);
      handleRef.current?.close();
    };
  }, []);

  const buttons = buttonEnabled(machine);
  return {
    open,
    machine,
    elapsedMs,
    speaking,
    muted,
    liveUnavailable,
    interim,
    original,
    english,
    coverage,
    silenceAsk,
    error,
    blocked,
    textSize,
    language,
    minimized,
    suggestions,
    levels,
    fills,
    fillMessage,
    buttons,
    stopsInMs: elapsedMs >= SCRIBE_MAX_RECORDING_MS - 60_000 ? Math.max(0, SCRIBE_MAX_RECORDING_MS - elapsedMs) : null,
    filling: machine === "drafting" || machine === "stopping",
    start,
    present,
    dismiss,
    pause,
    resume,
    stopAndDraft: () => {
      void stopAndDraft();
    },
    cancel: () => {
      void cancel();
    },
    toggleMute,
    retry,
    chooseLanguage,
    chooseMedicine,
    askTopic,
    copyTranscript: () => {
      void copyTranscript();
    },
    dismissSilence,
    setTextSize,
    setMinimized,
    openSettings: openInstalledSettings,
  };
}

export type ScribeCapture = ReturnType<typeof useScribeCapture>;
