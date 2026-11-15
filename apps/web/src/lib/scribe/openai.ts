import { audioFilename, normalizeAudioMime } from "@/lib/scribe/audio";
import { SCRIBE_MAX_TRANSCRIPT_CHARS } from "@/lib/scribe/limits";

const OPENAI_TRANSCRIPTIONS = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You convert an outpatient consultation transcript into a structured visit note for a doctor in India.

The doctor speaks in this order when they can: chief complaint, how long and associated symptoms, examination, diagnosis, each medicine with strength and timing, advice, then follow-up.

Rules:
- Write clear English clinical wording, even when the conversation is in another language or a mix of languages.
- Use only facts stated in the transcript. Never invent symptoms, findings, diagnoses, medicines, doses, durations, or advice.
- Do not drop a spoken complaint, diagnosis, medicine name, strength, or dose. If the dose was not said, still keep the medicine and set uncertain true.
- When both an English wording and the original words are given, keep any symptom, medicine, strength, or dose that appears in either. If they disagree, trust the original words.
- Leave a field empty only when that topic was never spoken.
- Put every topic that was never spoken into missingFields. Use only these names: chiefComplaint, history, examination, diagnosis, medicines, advice, followUp.
- chiefComplaint is the patient's complaints, separated by commas.
- history is onset, duration, and associated symptoms.
- examination is only what the doctor said they found.
- diagnoses are the labels the doctor stated.
- The words மருந்து, மாத்திரை, tablet, or medicine start a new medicine. Do not attach that dose to the previous medicine.
- medicines: keep the spoken name and strength in name. catalogChoice is an exact name from the known-medicines list, or an empty string when none clearly matches. Do not invent a catalog name. morning, afternoon, and night are true only when that time was stated. beforeFood and afterFood are true only when stated. durationDays is the number of days, or null. Put SOS and any other instruction in note. If the strength or the morning, afternoon, or night timing was not said, leave it unset and set uncertain true.
- advice is what the doctor told the patient to do.
- outcome is FOLLOW_UP when a review was asked, DISCHARGE when the patient was discharged, otherwise an empty string.
- followUpInDays is the number of days until review, or null.
- Add a field name to uncertainFields only when a word was spoken but the dose or name is unclear. Use these names only: chiefComplaint, history, examination, diagnosis, medicines, advice, followUp, outcome.`;

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
    "missingFields",
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
          "catalogChoice",
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
          catalogChoice: { type: "string" },
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
    missingFields: { type: "array", items: { type: "string" } },
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

export async function draftConsult(transcript: string, vocabulary: string[] = []): Promise<unknown> {
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
        model: scribeModel(),
        temperature: 0.1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
