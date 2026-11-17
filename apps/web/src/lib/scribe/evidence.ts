import {
  assembleDraft,
  type EvidenceKind,
  type ScribeCited,
  type ScribeDraft,
  type ScribeMedicine,
} from "@/lib/scribe/draft-schema";

const NUMBER_WORDS: Record<number, readonly string[]> = {
  1: ["one", "oru", "onru", "ondru", "ek", "ஒரு"],
  2: ["two", "rendu", "irandu", "do din", "ரெண்டு"],
  3: ["three", "moonu", "moondru", "teen", "மூன்று"],
  4: ["four", "naalu", "naangu", "char", "chaar", "நான்கு"],
  5: ["five", "anju", "ainthu", "paanch", "panch", "ஐந்து"],
  6: ["six", "aaru", "chhe", "che", "ஆறு"],
  7: ["seven", "ezhu", "ezu", "saat", "saath", "ஏழு"],
  8: ["eight", "ettu", "aath", "aat", "எட்டு"],
  9: ["nine", "onbathu", "onpathu", "nau", "ஒன்பது"],
  10: ["ten", "pathu", "das", "பத்து"],
  11: ["eleven"],
  12: ["twelve"],
  13: ["thirteen"],
  14: ["fourteen", "fortnight"],
  15: ["fifteen"],
  16: ["sixteen"],
  17: ["seventeen"],
  18: ["eighteen"],
  19: ["nineteen"],
  20: ["twenty"],
  21: ["twenty one"],
  30: ["thirty"],
  40: ["forty"],
  45: ["forty five"],
  60: ["sixty"],
  90: ["ninety"],
};

type CheckedField = "chiefComplaint" | "history" | "examination" | "diagnosis" | "advice";

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The quote has to be words that actually appear in the transcript. */
export function quoteInTranscript(quote: string, transcript: string) {
  const needle = normalize(quote);
  if (needle.length < 3) return false;
  return normalize(transcript).includes(needle);
}

export function quoteSupportsNumber(value: number, quote: string) {
  if (!Number.isInteger(value) || value < 1) return false;
  const text = ` ${normalize(quote)} `;
  if (text.includes(` ${value} `)) return true;
  return (NUMBER_WORDS[value] ?? []).some((word) => {
    const needle = normalize(word);
    return needle.length > 0 && text.includes(` ${needle} `);
  });
}

export function stripUnsupportedNumbers(value: string, quote: string) {
  return value
    .replace(/\d+/g, (digits) => (quoteSupportsNumber(Number(digits), quote) ? digits : ""))
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** A medicine name counts only when one of its words is in the quote. */
export function quoteMentionsSpoken(quote: string, spoken: string) {
  const haystack = new Set(normalize(quote).split(" ").filter(Boolean));
  const words = normalize(spoken)
    .split(" ")
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word));
  if (words.length === 0) return false;
  return words.some((word) => haystack.has(word));
}

function kindAllowed(field: CheckedField, kind: EvidenceKind) {
  if (field === "examination" || field === "diagnosis") return kind === "this_patient";
  if (field === "chiefComplaint") return kind === "this_patient" || kind === "patient_said";
  if (field === "history") return kind === "this_patient" || kind === "patient_said" || kind === "negated";
  return kind === "this_patient" || kind === "general_statement";
}

function acceptItem(item: ScribeCited, field: CheckedField, transcript: string): ScribeCited | null {
  if (!quoteInTranscript(item.quote, transcript)) return null;
  if (!kindAllowed(field, item.kind)) return null;
  const text = stripUnsupportedNumbers(item.text, item.quote).trim();
  if (!text) return null;
  return { ...item, text };
}

function acceptMedicine(medicine: ScribeMedicine, transcript: string): ScribeMedicine | null {
  if (medicine.kind !== "this_patient") return null;
  if (!quoteInTranscript(medicine.quote, transcript)) return null;
  const spoken = medicine.spokenName || medicine.name;
  if (!quoteMentionsSpoken(medicine.quote, spoken)) return null;
  const durationSupported = medicine.durationDays == null || quoteSupportsNumber(medicine.durationDays, medicine.quote);
  const name = stripUnsupportedNumbers(medicine.name, medicine.quote).trim();
  const spokenName = stripUnsupportedNumbers(spoken, medicine.quote).trim();
  if (!name && !spokenName) return null;
  return {
    ...medicine,
    name: name || spokenName,
    spokenName: spokenName || name,
    durationDays: durationSupported ? medicine.durationDays : null,
    uncertain: medicine.uncertain || !durationSupported,
  };
}

/** Drop statements the transcript does not support. This does not call a model. */
export function verifyEvidence(draft: ScribeDraft, transcript: string): ScribeDraft {
  const keep = (items: ScribeCited[], field: CheckedField) =>
    items.flatMap((item) => {
      const accepted = acceptItem(item, field, transcript);
      return accepted ? [accepted] : [];
    });

  const follow = draft.evidence.followUp;
  const followOk = Boolean(follow && quoteInTranscript(follow.quote, transcript) && follow.kind === "this_patient");
  const followUpInDays =
    followOk && follow && draft.followUpInDays != null && quoteSupportsNumber(draft.followUpInDays, follow.quote)
      ? draft.followUpInDays
      : null;

  return assembleDraft({
    evidence: {
      chiefComplaint: keep(draft.evidence.chiefComplaint, "chiefComplaint"),
      history: keep(draft.evidence.history, "history"),
      examination: keep(draft.evidence.examination, "examination"),
      diagnoses: keep(draft.evidence.diagnoses, "diagnosis"),
      advice: keep(draft.evidence.advice, "advice"),
      followUp: followOk && follow ? follow : null,
    },
    medicines: draft.medicines.flatMap((medicine) => {
      const accepted = acceptMedicine(medicine, transcript);
      return accepted ? [accepted] : [];
    }),
    followUpInDays,
    outcome: followOk ? draft.outcome : "",
    uncertainFields: draft.uncertainFields,
    missingFields: draft.missingFields,
  });
}
