const AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"]);

/** Browser recorders append codec parameters. OpenAI wants a bare audio type. */
export function normalizeAudioMime(mime: string): string | null {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "video/webm") return "audio/webm";
  if (base === "audio/x-wav" || base === "audio/wave") return "audio/wav";
  if (base === "audio/m4a" || base === "audio/x-m4a" || base === "audio/mp4") return "audio/mp4";
  return AUDIO_TYPES.has(base) ? base : null;
}

export function audioFilename(mime: string) {
  if (mime === "audio/mp4") return "chunk.m4a";
  if (mime === "audio/mpeg") return "chunk.mp3";
  if (mime === "audio/wav") return "chunk.wav";
  if (mime === "audio/ogg") return "chunk.ogg";
  return "chunk.webm";
}
