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
};

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
  })
  .strict();

const draftSchema = z
  .object({
    chiefComplaint: z.string(),
    history: z.string(),
    examination: z.string(),
    diagnoses: z.array(z.string()),
    medicines: z.array(medicineSchema),
    advice: z.string(),
    followUpInDays: z.number().int().nullable(),
    outcome: z.enum(["FOLLOW_UP", "DISCHARGE", ""]),
    uncertainFields: z.array(z.string()),
    missingFields: z.array(z.string()).optional(),
  })
  .strict();

function clip(value: string) {
  return value.trim().slice(0, SCRIBE_MAX_FIELD_CHARS);
}

function clampDays(value: number | null, max: number) {
  if (value == null || value < 1 || value > max) return null;
  return value;
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
        uncertain: medicine.uncertain || durationUnclear,
        matched: medicine.matched ?? false,
      },
    ];
  });

  return {
    ok: true,
    draft: {
      chiefComplaint: clip(raw.chiefComplaint),
      history: clip(raw.history),
      examination: clip(raw.examination),
      diagnoses: raw.diagnoses.map(clip).filter(Boolean).slice(0, SCRIBE_MAX_DIAGNOSES),
      medicines,
      advice: clip(raw.advice),
      followUpInDays,
      outcome: raw.outcome,
      uncertainFields: [...uncertain].slice(0, 20),
      missingFields: [...new Set((raw.missingFields ?? []).map((field) => field.trim()).filter(Boolean))].slice(0, 8),
    },
  };
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
