import { SarvamAIClient, SarvamAIError } from "sarvamai";
import { audioFilename, normalizeAudioMime } from "@/lib/scribe/audio";
import { ScribeProviderError } from "@/lib/scribe/openai";

export type ScribeListenLanguage = "auto" | "en" | "ta" | "hi" | "kn" | "ml";
export type SarvamModel = "saaras:v3" | "saaras:v4";

export type ScribeEnv = {
  SARVAM_API_KEY?: string;
  SARVAM_STT_MODEL?: string;
  SCRIBE_STT_PROVIDER?: string;
  [key: string]: string | undefined;
};

export const SARVAM_MAX_CLIP_MS = 30_000;

export function sarvamConfigured(env: ScribeEnv = process.env) {
  return Boolean(env.SARVAM_API_KEY?.trim());
}

export function sarvamModel(env: ScribeEnv = process.env): SarvamModel {
  const value = env.SARVAM_STT_MODEL?.trim();
  if (value === "saaras:v3" || value === "saaras:v4") return value;
  return "saaras:v4";
}

export function sarvamLanguageCode(language: ScribeListenLanguage): "ta-IN" | "hi-IN" | "kn-IN" | "ml-IN" | "unknown" {
  if (language === "ta") return "ta-IN";
  if (language === "hi") return "hi-IN";
  if (language === "kn") return "kn-IN";
  if (language === "ml") return "ml-IN";
  return "unknown";
}

export function scribeListener(language: ScribeListenLanguage, env: ScribeEnv = process.env): "sarvam" | "openai" {
  if (env.SCRIBE_STT_PROVIDER?.trim() === "openai") return "openai";
  if (!sarvamConfigured(env)) return "openai";
  if (language === "en") return "openai";
  return "sarvam";
}

export function clipWithinLimit(durationMs: number) {
  return Number.isFinite(durationMs) && durationMs >= 0 && durationMs <= SARVAM_MAX_CLIP_MS;
}

export function decideClipSeq(seq: number, chunkCount: number, maxSegments: number) {
  if (!Number.isInteger(seq) || seq < 1) return "invalid" as const;
  if (seq <= chunkCount) return "duplicate" as const;
  if (chunkCount >= maxSegments) return "long" as const;
  if (seq !== chunkCount + 1) return "order" as const;
  return "ok" as const;
}

export function listenLanguage(value: string): ScribeListenLanguage {
  if (value === "en" || value === "ta" || value === "hi" || value === "kn" || value === "ml" || value === "auto") return value;
  return "auto";
}

let remembered: SarvamModel | null = null;

function providerMessage(status: number | undefined) {
  if (status === 401 || status === 403) return "The Sarvam API key was rejected.";
  if (status === 429) return "The AI service is busy. Wait a moment and try again.";
  return "Could not transcribe that part of the conversation.";
}

function asProvider(error: unknown) {
  if (error instanceof ScribeProviderError) return error;
  const status = error instanceof SarvamAIError ? error.statusCode : undefined;
  return new ScribeProviderError(providerMessage(status), status === 429 ? 429 : 502);
}

function fileFromBytes(bytes: Uint8Array, mime: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], audioFilename(mime), { type: mime });
}

export async function transcribeClip(input: {
  bytes: Uint8Array;
  mime: string;
  language: ScribeListenLanguage;
  durationMs: number;
}) {
  if (!clipWithinLimit(input.durationMs)) throw new ScribeProviderError("That clip is too long.", 400);
  if (!sarvamConfigured()) throw new ScribeProviderError("Sarvam is not configured.", 503);
  const mime = normalizeAudioMime(input.mime);
  if (!mime) throw new ScribeProviderError("That recording format is not supported.", 400);
  if (input.bytes.byteLength < 1) throw new ScribeProviderError("That recording was empty.", 400);

  const locked = process.env.SARVAM_STT_MODEL?.trim();
  const model = locked === "saaras:v3" || locked === "saaras:v4" ? locked : (remembered ?? "saaras:v4");
  const client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY?.trim() });
  const file = fileFromBytes(input.bytes, mime);
  const languageCode = sarvamLanguageCode(input.language);

  async function once(chosen: SarvamModel) {
    const response = await client.speechToText.transcribe({
      file,
      model: chosen,
      mode: "codemix",
      language_code: languageCode,
    });
    return (response.transcript ?? "").trim();
  }

  try {
    const transcript = await once(model);
    remembered = model;
    return { transcript, model };
  } catch (error) {
    const fallback = model === "saaras:v4" && !locked && error instanceof SarvamAIError && error.statusCode === 400;
    if (!fallback) throw asProvider(error);
    try {
      const transcript = await once("saaras:v3");
      remembered = "saaras:v3";
      return { transcript, model: "saaras:v3" as const };
    } catch (again) {
      throw asProvider(again);
    }
  }
}
