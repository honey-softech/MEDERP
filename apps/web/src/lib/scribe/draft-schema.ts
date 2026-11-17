import { z } from "zod";
import { SCRIBE_MAX_DIAGNOSES, SCRIBE_MAX_FIELD_CHARS, SCRIBE_MAX_MEDICINES } from "@/lib/scribe/limits";

export const SCRIBE_ASSESSMENT_KEYS = [
  "chiefComplaint",
  "examination",
  "diagnosis",
  "summary",
  "prescription",
  "advice",
  "followUpAt",
  "visitOutcome",
] as const;

export type ScribeAssessmentKey = (typeof SCRIBE_ASSESSMENT_KEYS)[number];

export type ScribeAssessmentPatch = Partial<Record<ScribeAssessmentKey, string>>;

export type ScribeFillMode = "preview" | "final";

export const EVIDENCE_KINDS = [
  "this_patient",
  "general_statement",
  "possibility",
  "negated",
  "question",
  "patient_said",
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** One statement the note writer attributed to the transcript. */
export type ScribeCited = {
  text: string;
  quote: string;
  kind: EvidenceKind;
};

export type ScribeEvidence = {
  chiefComplaint: ScribeCited[];
  history: ScribeCited[];
  examination: ScribeCited[];
  diagnoses: ScribeCited[];
  advice: ScribeCited[];
  followUp: ScribeCited | null;
};

export type ScribeSources = Record<
  "chiefComplaint" | "history" | "examination" | "diagnosis" | "medicines" | "advice" | "followUp",
  string
>;

export type ScribeMedicine = {
  name: string;
  spokenName: string;
  morning: boolean;
  afternoon: boolean;
  night: boolean;
  beforeFood: boolean;
  afterFood: boolean;
  durationDays: number | null;
  note: string;
  uncertain: boolean;
  matched: boolean;
  /** Catalog names to offer when the spoken name is not certain. */
  alternatives: string[];
  catalogChoice?: string;
  quote: string;
  kind: EvidenceKind;
};

export type ScribeDraft = {
  chiefComplaint: string;
  history: string;
  examination: string;
  diagnoses: string[];
  medicines: ScribeMedicine[];
  advice: string;
  followUpInDays: number | null;
  outcome: "FOLLOW_UP" | "DISCHARGE" | "";
  uncertainFields: string[];
  missingFields?: string[];
  evidence: ScribeEvidence;
  sources: ScribeSources;
};

const kindSchema = z.enum(EVIDENCE_KINDS);

const citedSchema = z
  .object({
    text: z.string(),
    quote: z.string(),
    kind: kindSchema,
  })
  .strict();

const citedOrString = z.union([z.string(), citedSchema]);
const looseText = z.union([z.string(), z.array(citedOrString)]);

const evidenceSchema = z
  .object({
    chiefComplaint: z.array(citedSchema),
    history: z.array(citedSchema),
    examination: z.array(citedSchema),
    diagnoses: z.array(citedSchema),
    advice: z.array(citedSchema),
    followUp: citedSchema.nullable(),
  })
  .strict();

const medicineSchema = z
  .object({
    name: z.string(),
    spokenName: z.string().optional(),
    morning: z.boolean(),
    afternoon: z.boolean(),
    night: z.boolean(),
    beforeFood: z.boolean(),
    afterFood: z.boolean(),
    durationDays: z.number().int().nullable(),
    note: z.string(),
    uncertain: z.boolean(),
    matched: z.boolean().optional(),
    alternatives: z.array(z.string()).optional(),
    catalogChoice: z.string().optional(),
    quote: z.string().optional(),
    kind: kindSchema.optional(),
  })
  .strict();

const draftSchema = z
  .object({
    chiefComplaint: looseText,
    history: looseText,
    examination: looseText,
    diagnoses: z.array(citedOrString),
    medicines: z.array(medicineSchema),
    advice: looseText,
    followUpInDays: z.number().int().nullable(),
    followUpQuote: z.string().optional(),
    followUpKind: kindSchema.optional(),
    outcome: z.enum(["FOLLOW_UP", "DISCHARGE", ""]),
    uncertainFields: z.array(z.string()),
    missingFields: z.array(z.string()).optional(),
    evidence: evidenceSchema.optional(),
    sources: z
      .object({
        chiefComplaint: z.string().optional(),
        history: z.string().optional(),
        examination: z.string().optional(),
        diagnosis: z.string().optional(),
        medicines: z.string().optional(),
        advice: z.string().optional(),
        followUp: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function clip(value: string) {
  return value.trim().slice(0, SCRIBE_MAX_FIELD_CHARS);
}

function clampDays(value: number | null, max: number) {
  if (value == null || value < 1 || value > max) return null;
  return value;
}

type CitedInput = { text: string; quote: string; kind: EvidenceKind };
type LooseText = string | Array<string | CitedInput>;

function readCited(value: LooseText | undefined): ScribeCited[] {
  if (value == null) return [];
  const list = typeof value === "string" ? [value] : value;
  const items: ScribeCited[] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      const text = clip(entry);
      if (text) items.push({ text, quote: "", kind: "this_patient" });
      continue;
    }
    const text = clip(entry.text);
    if (!text) continue;
    items.push({ text, quote: clip(entry.quote), kind: entry.kind });
  }
  return items;
}

function evidenceHasItems(evidence: ScribeEvidence) {
  return (
    evidence.chiefComplaint.length +
      evidence.history.length +
      evidence.examination.length +
      evidence.diagnoses.length +
      evidence.advice.length >
      0 || evidence.followUp != null
  );
}

function clipCited(items: ScribeCited[], max: number) {
  const clipped: ScribeCited[] = [];
  for (const item of items.slice(0, max)) {
    const text = clip(item.text);
    if (!text) continue;
    clipped.push({ text, quote: clip(item.quote), kind: item.kind });
  }
  return clipped;
}

function joinTexts(items: ScribeCited[], separator: string) {
  return clip(items.map((item) => item.text.trim()).filter(Boolean).join(separator));
}

function joinQuotes(items: ScribeCited[]) {
  return clip(items.map((item) => item.quote.trim()).filter(Boolean).join(" · "));
}

export function assembleDraft(input: {
  evidence: ScribeEvidence;
  medicines: ScribeMedicine[];
  followUpInDays: number | null;
  outcome: ScribeDraft["outcome"];
  uncertainFields: string[];
  missingFields?: string[];
}): ScribeDraft {
  const followUp = input.evidence.followUp ? clipCited([input.evidence.followUp], 1)[0] ?? null : null;
  const evidence: ScribeEvidence = {
    chiefComplaint: clipCited(input.evidence.chiefComplaint, 12),
    history: clipCited(input.evidence.history, 12),
    examination: clipCited(input.evidence.examination, 12),
    diagnoses: clipCited(input.evidence.diagnoses, SCRIBE_MAX_DIAGNOSES),
    advice: clipCited(input.evidence.advice, 12),
    followUp,
  };
  const medicines = input.medicines.slice(0, SCRIBE_MAX_MEDICINES);
  return {
    chiefComplaint: joinTexts(evidence.chiefComplaint, ", "),
    history: joinTexts(evidence.history, " "),
    examination: joinTexts(evidence.examination, " "),
    diagnoses: evidence.diagnoses.map((item) => item.text.trim()).filter(Boolean),
    medicines,
    advice: joinTexts(evidence.advice, " "),
    followUpInDays: input.followUpInDays,
    outcome: input.outcome,
    uncertainFields: input.uncertainFields.slice(0, 20),
    missingFields: input.missingFields?.slice(0, 8),
    evidence,
    sources: {
      chiefComplaint: joinQuotes(evidence.chiefComplaint),
      history: joinQuotes(evidence.history),
      examination: joinQuotes(evidence.examination),
      diagnosis: joinQuotes(evidence.diagnoses),
      medicines: joinQuotes(medicines.map((medicine) => ({ text: medicine.name, quote: medicine.quote, kind: medicine.kind }))),
      advice: joinQuotes(evidence.advice),
      followUp: evidence.followUp?.quote.trim() ?? "",
    },
  };
}

export function parseScribeDraft(value: unknown): { ok: true; draft: ScribeDraft } | { ok: false; error: string } {
  const parsed = draftSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: "The draft could not be read. Try again." };
  }
  const raw = parsed.data;
  const uncertain = new Set(raw.uncertainFields.map((field) => field.trim()).filter(Boolean));
  const followUpInDays = clampDays(raw.followUpInDays, 365);
  if (raw.followUpInDays != null && followUpInDays == null) uncertain.add("followUp");

  const medicines: ScribeMedicine[] = raw.medicines.slice(0, SCRIBE_MAX_MEDICINES).flatMap((medicine) => {
    const spokenName = clip(medicine.spokenName ?? medicine.name);
    const name = clip(medicine.name);
    if (!name && !spokenName) return [];
    const durationDays = clampDays(medicine.durationDays, 90);
    const durationUnclear = medicine.durationDays != null && durationDays == null;
    const doseUnsaid = !medicine.morning && !medicine.afternoon && !medicine.night && !/sos/i.test(medicine.note);
    return [
      {
        name: name || spokenName,
        spokenName: spokenName || name,
        morning: medicine.morning,
        afternoon: medicine.afternoon,
        night: medicine.night,
        beforeFood: medicine.beforeFood,
        afterFood: medicine.afterFood,
        durationDays,
        note: clip(medicine.note),
        uncertain: medicine.uncertain || durationUnclear || doseUnsaid,
        matched: medicine.matched ?? false,
        alternatives: [...new Set((medicine.alternatives ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, 3),
        catalogChoice: medicine.catalogChoice?.trim() || undefined,
        quote: clip(medicine.quote ?? ""),
        kind: medicine.kind ?? "this_patient",
      },
    ];
  });

  const stored = raw.evidence;
  const followQuote = clip(raw.followUpQuote ?? "");
  const synthesized: ScribeEvidence = {
    chiefComplaint: readCited(raw.chiefComplaint),
    history: readCited(raw.history),
    examination: readCited(raw.examination),
    diagnoses: readCited(raw.diagnoses),
    advice: readCited(raw.advice),
    followUp: followQuote
      ? { text: followQuote, quote: followQuote, kind: raw.followUpKind ?? "this_patient" }
      : null,
  };
  const evidence = stored && evidenceHasItems(stored) ? stored : synthesized;

  return {
    ok: true,
    draft: assembleDraft({
      evidence,
      medicines,
      followUpInDays,
      outcome: raw.outcome,
      uncertainFields: [...uncertain],
      missingFields: [...new Set((raw.missingFields ?? []).map((field) => field.trim()).filter(Boolean))],
    }),
  };
}

/** Preview fills only fields the doctor has not edited. Stop still fills every field. */
export function selectScribePatch(input: {
  patch: ScribeAssessmentPatch;
  edited: readonly ScribeAssessmentKey[];
  mode: ScribeFillMode;
}): ScribeAssessmentPatch {
  const selected: ScribeAssessmentPatch = {};
  const edited = new Set(input.mode === "preview" ? input.edited : []);
  for (const key of SCRIBE_ASSESSMENT_KEYS) {
    if (edited.has(key)) continue;
    const value = input.patch[key];
    if (typeof value !== "string") continue;
    selected[key] = value;
  }
  return selected;
}

export function medicineNotes(medicine: ScribeMedicine) {
  const hasTiming = medicine.morning || medicine.afternoon || medicine.night;
  const timing = hasTiming
    ? `${medicine.morning ? "1" : "0"}-${medicine.afternoon ? "1" : "0"}-${medicine.night ? "1" : "0"}`
    : "";
  const food =
    medicine.beforeFood && !medicine.afterFood ? "BF" : medicine.afterFood && !medicine.beforeFood ? "AF" : "";
  const duration =
    medicine.durationDays == null
      ? ""
      : medicine.durationDays === 1
        ? "for 1 day"
        : `for ${medicine.durationDays} days`;
  return [timing, food, duration, medicine.note.trim()].filter(Boolean).join(" ");
}

export function prescriptionFromDraft(draft: ScribeDraft) {
  return draft.medicines
    .filter((medicine) => medicine.name.trim())
    .map((medicine) => {
      const notes = medicineNotes(medicine);
      const name = medicine.name.trim();
      return notes ? `${name} || ${notes}` : name;
    })
    .join("\n");
}

/** Local calendar date, matching the visit form's date input. */
export function followUpDateFromDays(days: number | null, today = new Date()) {
  if (!days || days < 1) return "";
  const date = new Date(today);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function draftToAssessment(draft: ScribeDraft, today = new Date()): Record<ScribeAssessmentKey, string> {
  const followUpAt = followUpDateFromDays(draft.followUpInDays, today);
  const visitOutcome = draft.outcome || (followUpAt ? "FOLLOW_UP" : "");
  return {
    chiefComplaint: draft.chiefComplaint.trim(),
    examination: draft.examination.trim(),
    diagnosis: draft.diagnoses.map((item) => item.trim()).filter(Boolean).join(", "),
    summary: draft.history.trim(),
    prescription: prescriptionFromDraft(draft),
    advice: draft.advice.trim(),
    followUpAt,
    visitOutcome,
  };
}

const FIELD_ALIASES: Record<string, ScribeAssessmentKey> = {
  chiefcomplaint: "chiefComplaint",
  complaint: "chiefComplaint",
  complaints: "chiefComplaint",
  history: "summary",
  hpi: "summary",
  summary: "summary",
  examination: "examination",
  exam: "examination",
  diagnosis: "diagnosis",
  diagnoses: "diagnosis",
  medicines: "prescription",
  medicine: "prescription",
  prescription: "prescription",
  advice: "advice",
  followup: "followUpAt",
  followupindays: "followUpAt",
  outcome: "visitOutcome",
  visitoutcome: "visitOutcome",
};

const MISSING_LABELS: Record<string, string> = {
  chiefcomplaint: "chief complaint",
  complaint: "chief complaint",
  complaints: "chief complaint",
  history: "how long and other symptoms",
  hpi: "how long and other symptoms",
  summary: "how long and other symptoms",
  examination: "examination",
  exam: "examination",
  diagnosis: "diagnosis",
  diagnoses: "diagnosis",
  medicines: "medicines and dose",
  medicine: "medicines and dose",
  prescription: "medicines and dose",
  advice: "advice",
  followup: "follow-up",
  followupindays: "follow-up",
};

const MISSING_ORDER = [
  "chief complaint",
  "how long and other symptoms",
  "examination",
  "diagnosis",
  "medicines and dose",
  "advice",
  "follow-up",
];

export function missingLabels(fields: string[]) {
  const found = new Set<string>();
  for (const field of fields) {
    const label = MISSING_LABELS[field.toLowerCase().replace(/[^a-z]/g, "")];
    if (label) found.add(label);
  }
  return MISSING_ORDER.filter((label) => found.has(label));
}

export function medicineChoicesFromDraft(draft: ScribeDraft) {
  const choices: Record<string, string[]> = {};
  for (const medicine of draft.medicines) {
    const name = medicine.name.trim();
    const options = medicine.alternatives.filter((item) => item.trim() && item.trim() !== name);
    if (name && options.length > 0) choices[name] = options;
  }
  return choices;
}

export function fieldsToCheck(draft: ScribeDraft): ScribeAssessmentKey[] {
  const flags = new Set<ScribeAssessmentKey>();
  for (const field of draft.uncertainFields) {
    const key = FIELD_ALIASES[field.toLowerCase().replace(/[^a-z]/g, "")];
    if (key) flags.add(key);
  }
  if (draft.medicines.some((medicine) => medicine.uncertain)) flags.add("prescription");
  return [...flags];
}

export function catalogNameForSpoken(spoken: string, candidates: string[]) {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const query = norm(spoken);
  const label = spoken.trim();
  if (!query) return { name: label, matched: false };

  let best: { name: string; score: number } | null = null;
  for (const candidate of candidates) {
    const normalized = norm(candidate);
    if (!normalized) continue;
    const exact = normalized === query;
    const prefix = query.length >= 3 && (normalized.startsWith(query) || query.startsWith(normalized));
    if (!exact && !prefix) continue;
    const score = exact ? 0 : Math.abs(normalized.length - query.length);
    if (!best || score < best.score) best = { name: candidate.trim(), score };
  }
  return best ? { name: best.name, matched: true } : { name: label, matched: false };
}

export function resolveAiAssisted(input: {
  approve: boolean;
  entryMode: "TYPED" | "HANDWRITTEN";
  sessionApplied: boolean;
  previous: boolean;
}) {
  if (input.approve && input.entryMode === "TYPED" && input.sessionApplied) return true;
  return input.previous;
}
