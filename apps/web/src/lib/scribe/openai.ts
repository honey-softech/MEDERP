import { audioFilename, normalizeAudioMime } from "@/lib/scribe/audio";
import { SCRIBE_MAX_TRANSCRIPT_CHARS } from "@/lib/scribe/limits";

const OPENAI_TRANSCRIPTIONS = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You convert an outpatient consultation transcript into a structured visit note for a doctor in India.

Rules:
- Write clear English clinical wording, even when the conversation is in another language or a mix of languages.
- Use only facts stated in the transcript. Never invent symptoms, findings, diagnoses, medicines, doses, durations, or advice.
- Leave a field empty when it was not mentioned: empty string, empty array, or null.
- chiefComplaint is a short list of the patient's complaints.
- history is the history of the present illness: onset, duration, and associated symptoms.
- examination is only what the doctor actually observed or said they found.
- diagnoses are short labels the doctor stated or clearly concluded.
- medicines: name as spoken. morning, afternoon, and night are true only when a dose at that time was stated. beforeFood and afterFood are true only when stated. durationDays is the number of days, or null. Put SOS and any other instruction in note. Set uncertain true when the name or dose is unclear.
- advice is what the doctor told the patient to do.
- outcome is FOLLOW_UP when a review was asked, DISCHARGE when the patient was discharged, otherwise an empty string.
- followUpInDays is the number of days until review, or null.
- Add the field name to uncertainFields when you are not confident. Use these names only: chiefComplaint, history, examination, diagnosis, medicines, advice, followUp, outcome.`;

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
    "outcome",
    "uncertainFields",
  ],
  properties: {
    chiefComplaint: { type: "string" },
    history: { type: "string" },
    examination: { type: "string" },
    diagnoses: { type: "array", items: { type: "string" } },
    medicines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "morning",
          "afternoon",
          "night",
          "beforeFood",
          "afterFood",
          "durationDays",
          "note",
          "uncertain",
        ],
        properties: {
          name: { type: "string" },
          morning: { type: "boolean" },
          afternoon: { type: "boolean" },
          night: { type: "boolean" },
          beforeFood: { type: "boolean" },
          afterFood: { type: "boolean" },
          durationDays: { type: ["integer", "null"] },
          note: { type: "string" },
          uncertain: { type: "boolean" },
        },
      },
    },
    advice: { type: "string" },
    followUpInDays: { type: ["integer", "null"] },
    outcome: { type: "string", enum: ["FOLLOW_UP", "DISCHARGE", ""] },
    uncertainFields: { type: "array", items: { type: "string" } },
  },
} as const;

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

export function scribeModel() {
  return process.env.OPENAI_SCRIBE_MODEL?.trim() || "gpt-4o-mini";
}

export function scribeNotConfiguredMessage() {
  return "AI scribe is not configured. Add an OpenAI API key on the server.";
}

function providerMessage(status: number, fallback: string) {
  if (status === 401 || status === 403) return "The OpenAI API key was rejected.";
  if (status === 429) return "The AI service is busy. Wait a moment and try again.";
  return fallback;
}

export async function transcribeAudio(input: { bytes: Uint8Array; mime: string }) {
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
  body.set("prompt", "Outpatient consultation. Symptoms, examination, diagnosis, medicine names, and doses.");

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
              "You translate one fragment of a doctor-patient conversation into clear English. Keep names, symptoms, doses, and timing. Do not add anything that was not said. If the fragment is already English, return it unchanged. Return only the English text.",
          },
          { role: "user", content: source.slice(0, 4_000) },
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

export async function draftConsult(transcript: string): Promise<unknown> {
  const key = openAiApiKey();
  if (!key) throw new ScribeProviderError(scribeNotConfiguredMessage(), 503);
  const text = transcript.trim().slice(0, SCRIBE_MAX_TRANSCRIPT_CHARS);
  if (!text) throw new ScribeProviderError("Record the consultation before drafting.", 400);

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
        temperature: 0.1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Transcript:\n"""\n${text}\n"""` },
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
