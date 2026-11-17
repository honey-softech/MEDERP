import { audioFilename, normalizeAudioMime } from "@/lib/scribe/audio";
import { SCRIBE_MAX_TRANSCRIPT_CHARS } from "@/lib/scribe/limits";

const OPENAI_TRANSCRIPTIONS = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";
const OPENAI_CLIENT_SECRETS = "https://api.openai.com/v1/realtime/client_secrets";

export type RealtimeLanguage = "auto" | "en" | "ta" | "hi" | "kn" | "ml";

export const SCRIBE_SYSTEM_PROMPT = `You convert an outpatient consultation transcript into a structured visit note for a doctor in India.

The doctor speaks in this order when they can: chief complaint, how long and associated symptoms, examination, diagnosis, each medicine with strength and timing, advice, then follow-up.

Rules:
- Write clear English clinical wording, even when the conversation is in another language or a mix of languages.
- Use only facts stated in the transcript. Never invent symptoms, findings, diagnoses, medicines, doses, durations, or advice.
- If the doctor did not name a medicine, medicines must be an empty array. Never copy a known-medicine list into the note.
- Do not drop a spoken complaint, diagnosis, medicine name, strength, or dose. If the dose was not said, still keep the medicine and set uncertain true.
- When both an English wording and the original words are given, keep any symptom, medicine, strength, or dose that appears in either. If they disagree, trust the original words.
- Leave a list empty only when that topic was never spoken.
- Put every topic that was never spoken into missingFields. Use only these names: chiefComplaint, history, examination, diagnosis, medicines, advice, followUp.
- Each complaint, history line, examination finding, diagnosis, and advice item has text, quote, and kind. quote is the exact words from the transcript. kind is one of this_patient, general_statement, possibility, negated, question, patient_said.
- Only this_patient statements from the doctor go into diagnosis, examination, and medicines. General teaching, causes, risks, possibilities, conditions, and questions never enter those rows. A general statement can go to advice only when it is an instruction to the patient.
- chiefComplaint items are the patient's complaints.
- history items are onset, duration, and associated symptoms.
- examination items are only what the doctor said they found on this patient.
- diagnosis items are labels for this patient's condition.
- The words மருந்து, மாத்திரை, tablet, or medicine start a new medicine. Do not attach that dose to the previous medicine.
- A line that starts with "Medicine:" is the doctor's own confirmed medicine. Use that exact name, set catalogChoice to it, and quote that line. Do not replace it with a similar-sounding drug.
- medicines: keep the spoken name and strength in name. quote is the exact words that name the medicine. kind is this_patient only when the doctor prescribed it for this patient. catalogChoice is an exact name from the known-medicines list, or an empty string when none clearly matches. Do not invent a catalog name. morning, afternoon, and night are true only when that time was stated. beforeFood and afterFood are true only when stated. durationDays is the number of days, or null. Put SOS and any other instruction in note. If the strength or the morning, afternoon, or night timing was not said, leave it unset and set uncertain true.
- advice items are what the doctor told the patient to do.
- outcome is FOLLOW_UP when a review was asked, DISCHARGE when the patient was discharged, otherwise an empty string.
- followUpQuote is the exact words that support the review or discharge, or empty when neither was said. followUpKind classifies that sentence.
- followUpInDays is the number of days until review, or null. Use a number only when that number was spoken.
- Add a field name to uncertainFields only when a word was spoken but the dose or name is unclear. Use these names only: chiefComplaint, history, examination, diagnosis, medicines, advice, followUp, outcome.`;

const EVIDENCE_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text", "quote", "kind"],
  properties: {
    text: { type: "string" },
    quote: { type: "string" },
    kind: {
      type: "string",
      enum: ["this_patient", "general_statement", "possibility", "negated", "question", "patient_said"],
    },
  },
} as const;

const EVIDENCE_LIST_SCHEMA = { type: "array", items: EVIDENCE_ITEM_SCHEMA } as const;

const CONSULT_DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "chiefComplaint",
    "history",
    "examination",
    "diagnoses",
    "medicines",
    "advice",
    "followUpInDays",
    "followUpQuote",
    "followUpKind",
    "outcome",
    "uncertainFields",
    "missingFields",
  ],
  properties: {
    chiefComplaint: EVIDENCE_LIST_SCHEMA,
    history: EVIDENCE_LIST_SCHEMA,
    examination: EVIDENCE_LIST_SCHEMA,
    diagnoses: EVIDENCE_LIST_SCHEMA,
    medicines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "catalogChoice",
          "morning",
          "afternoon",
          "night",
          "beforeFood",
          "afterFood",
          "durationDays",
          "note",
          "uncertain",
          "quote",
          "kind",
        ],
        properties: {
          name: { type: "string" },
          catalogChoice: { type: "string" },
          morning: { type: "boolean" },
          afternoon: { type: "boolean" },
          night: { type: "boolean" },
          beforeFood: { type: "boolean" },
          afterFood: { type: "boolean" },
          durationDays: { type: ["integer", "null"] },
          note: { type: "string" },
          uncertain: { type: "boolean" },
          quote: { type: "string" },
          kind: {
            type: "string",
            enum: ["this_patient", "general_statement", "possibility", "negated", "question", "patient_said"],
          },
        },
      },
    },
    advice: EVIDENCE_LIST_SCHEMA,
    followUpInDays: { type: ["integer", "null"] },
    followUpQuote: { type: "string" },
    followUpKind: {
      type: "string",
      enum: ["this_patient", "general_statement", "possibility", "negated", "question", "patient_said"],
    },
    outcome: { type: "string", enum: ["FOLLOW_UP", "DISCHARGE", ""] },
    uncertainFields: { type: "array", items: { type: "string" } },
    missingFields: { type: "array", items: { type: "string" } },
  },
} as const;

/**
 * USD per million tokens from OpenAI's pricing page on 16 Nov 2026.
 * gpt-4o-mini is $0.15 input and $0.60 output.
 * Six previews plus one final call, at about 4,000 input and 800 output tokens each,
 * is about ₹0.70 at ₹94 per dollar. That stays under ₹1 for the note itself.
 */
export const SCRIBE_EXTRACTION_USD_PER_MILLION = { input: 0.15, output: 0.6 } as const;

export function extractionSpendInr(input: { calls: number; inputTokens: number; outputTokens: number; usdToInr: number }) {
  const usd =
    (input.calls *
      (input.inputTokens * SCRIBE_EXTRACTION_USD_PER_MILLION.input +
        input.outputTokens * SCRIBE_EXTRACTION_USD_PER_MILLION.output)) /
    1_000_000;
  return usd * input.usdToInr;
}

export class ScribeProviderError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function openAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

export function scribeConfigured() {
  return openAiApiKey().length > 0;
}

export function transcribeModel() {
  return process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-transcribe";
}

/** Mid-consult field updates. Override with OPENAI_SCRIBE_PREVIEW_MODEL. */
export function scribePreviewModel() {
  return process.env.OPENAI_SCRIBE_PREVIEW_MODEL?.trim() || "gpt-4o-mini";
}

/** The note written when the doctor stops. Override with OPENAI_SCRIBE_MODEL. */
export function scribeModel() {
  return process.env.OPENAI_SCRIBE_MODEL?.trim() || "gpt-4o-mini";
}

export function scribeModelFrom(
  env: { OPENAI_SCRIBE_MODEL?: string; OPENAI_SCRIBE_PREVIEW_MODEL?: string },
  kind: "preview" | "final",
) {
  const value = (kind === "preview" ? env.OPENAI_SCRIBE_PREVIEW_MODEL : env.OPENAI_SCRIBE_MODEL)?.trim();
  return value || "gpt-4o-mini";
}

export function scribeNotConfiguredMessage() {
  return "AI scribe is not configured. Add an OpenAI API key on the server.";
}

function providerMessage(status: number, fallback: string) {
  if (status === 401 || status === 403) return "The OpenAI API key was rejected.";
  if (status === 429) return "The AI service is busy. Wait a moment and try again.";
  return fallback;
}

/** Short-lived browser credential for a transcription-only realtime session. The API key stays on the server. */
export async function createRealtimeTranscriptionSecret(input: { prompt: string; language: RealtimeLanguage }) {
  const key = openAiApiKey();
  if (!key) throw new ScribeProviderError(scribeNotConfiguredMessage(), 503);
  const transcription: { model: string; prompt: string; language?: string } = {
    model: transcribeModel(),
    prompt: input.prompt.trim().slice(0, 900) || "Outpatient visit. Keep every symptom, medicine name, strength, and dose.",
  };
  if (input.language !== "auto") transcription.language = input.language;

  let response: Response;
  try {
    response = await fetch(OPENAI_CLIENT_SECRETS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "transcription",
          audio: {
            input: {
              transcription,
              noise_reduction: { type: "near_field" },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 700,
                create_response: false,
              },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("scribe realtime secret failed", error instanceof Error ? error.name : "error");
    throw new ScribeProviderError("Could not start live transcription.");
  }

  const payload = (await response.json().catch(() => null)) as {
    value?: unknown;
    expires_at?: unknown;
    client_secret?: { value?: unknown; expires_at?: unknown };
  } | null;
  const secret =
    typeof payload?.value === "string"
      ? payload.value
      : typeof payload?.client_secret?.value === "string"
        ? payload.client_secret.value
        : "";
  if (!response.ok || !secret) {
    console.error("scribe realtime secret rejected", response.status);
    throw new ScribeProviderError(
      providerMessage(response.status, "Could not start live transcription."),
      response.status === 429 ? 429 : response.status === 503 ? 503 : 502,
    );
  }
  const expiresAt =
    typeof payload?.expires_at === "number"
      ? payload.expires_at
      : typeof payload?.client_secret?.expires_at === "number"
        ? payload.client_secret.expires_at
        : 0;
  return { clientSecret: secret, expiresAt };
}

/** Keep the SDP line ending OpenAI requires. trim() drops it and the call is rejected. */
function normalizeSdp(value: string) {
  const body = value.replace(/^\uFEFF/, "").trim().replace(/\r\n|\r|\n/g, "\r\n");
  if (!body.startsWith("v=0") || !body.includes("m=audio")) return "";
  return `${body}\r\n`;
}

/** Opens the realtime call on the server so the browser never calls OpenAI directly. */
export async function openRealtimeCall(input: { sdp: string; prompt: string; language: RealtimeLanguage }) {
  const sdp = normalizeSdp(input.sdp);
  if (!sdp) throw new ScribeProviderError("Could not start live transcription.", 400);
  const secret = await createRealtimeTranscriptionSecret({ prompt: input.prompt, language: input.language });

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret.clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: sdp,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("scribe realtime call failed", error instanceof Error ? error.name : "error");
    throw new ScribeProviderError("Could not start live transcription.", 502);
  }

  const answer = await response.text();
  if (response.ok && answer.trim().startsWith("v=")) return answer;
  const message = answer.replace(/\s+/g, " ").slice(0, 180);
  console.error("scribe realtime call rejected", response.status, message);
  throw new ScribeProviderError(
    providerMessage(response.status, "Could not start live transcription."),
    response.status === 429 ? 429 : 502,
  );
}

export async function transcribeAudio(input: { bytes: Uint8Array; mime: string; prompt?: string }) {
  const key = openAiApiKey();
  if (!key) throw new ScribeProviderError(scribeNotConfiguredMessage(), 503);
  const mime = normalizeAudioMime(input.mime);
  if (!mime) throw new ScribeProviderError("That recording format is not supported.", 400);
  if (input.bytes.byteLength < 1) throw new ScribeProviderError("That recording was empty.", 400);

  const copy = new ArrayBuffer(input.bytes.byteLength);
  new Uint8Array(copy).set(input.bytes);
  const body = new FormData();
  body.set("file", new File([copy], audioFilename(mime), { type: mime }));
  body.set("model", transcribeModel());
  body.set("response_format", "json");
  body.set("prompt", input.prompt?.trim() || "Outpatient visit. Keep every symptom, medicine name, strength, and dose.");

  let response: Response;
  try {
    response = await fetch(OPENAI_TRANSCRIPTIONS, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    console.error("scribe transcribe request failed", error instanceof Error ? error.name : "error");
    throw new ScribeProviderError("Could not transcribe that part of the conversation.");
  }

  const payload = (await response.json().catch(() => null)) as { text?: unknown } | null;
  if (!response.ok) {
    console.error("scribe transcribe rejected", response.status);
    throw new ScribeProviderError(providerMessage(response.status, "Could not transcribe that part of the conversation."), response.status === 429 ? 429 : 502);
  }
  return typeof payload?.text === "string" ? payload.text.trim() : "";
}

/** Turn one spoken fragment into clear English without adding facts. */
export async function translateUtterance(text: string): Promise<string> {
  const source = text.trim();
  if (!source) return "";
  const key = openAiApiKey();
  if (!key) throw new ScribeProviderError(scribeNotConfiguredMessage(), 503);

  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: scribeModel(),
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Translate this outpatient consultation into clear English. Keep every symptom, diagnosis, medicine name, strength, and dose exactly. Do not summarise and do not add anything that was not said. If it is already English, return it unchanged. Return only the English text.",
          },
          { role: "user", content: source.slice(0, 12_000) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("scribe translate request failed", error instanceof Error ? error.name : "error");
    throw new ScribeProviderError("Could not translate that part of the conversation.");
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  } | null;
  if (!response.ok) {
    console.error("scribe translate rejected", response.status);
    throw new ScribeProviderError(
      providerMessage(response.status, "Could not translate that part of the conversation."),
      response.status === 429 ? 429 : 502,
    );
  }
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim().replace(/^["']|["']$/g, "") : "";
}

export async function draftConsult(transcript: string, vocabulary: string[] = [], model = scribeModel()): Promise<unknown> {
  const key = openAiApiKey();
  if (!key) throw new ScribeProviderError(scribeNotConfiguredMessage(), 503);
  const text = transcript.trim().slice(0, SCRIBE_MAX_TRANSCRIPT_CHARS);
  if (!text) throw new ScribeProviderError("Record the consultation before drafting.", 400);

  const list = vocabulary
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 60)
    .map((name) => `- ${name}`)
    .join("\n");
  const known = list
    ? `Known medicines. Set catalogChoice to one of these exact names only when the spoken medicine clearly matches. Otherwise catalogChoice is empty.\n${list}\n\n`
    : "No known-medicine list. Leave every catalogChoice empty.\n\n";

  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: SCRIBE_SYSTEM_PROMPT },
          { role: "user", content: `${known}Transcript:\n"""\n${text}\n"""` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "consult_draft",
            strict: true,
            schema: CONSULT_DRAFT_JSON_SCHEMA,
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    console.error("scribe draft request failed", error instanceof Error ? error.name : "error");
    throw new ScribeProviderError("Could not draft the visit note.");
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  } | null;
  if (!response.ok) {
    console.error("scribe draft rejected", response.status);
    throw new ScribeProviderError(providerMessage(response.status, "Could not draft the visit note."), response.status === 429 ? 429 : 502);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new ScribeProviderError("The draft came back empty. Try again.");
  }
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new ScribeProviderError("The draft could not be read. Try again.");
  }
}
