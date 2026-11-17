import { draftToAssessment, type ScribeDraft } from "@/lib/scribe/draft-schema";
import type { EvalCase, EvalField } from "@/lib/scribe/eval/cases";

export type ScoreHit = { id: string; field: EvalField; text: string };

export function fieldText(draft: ScribeDraft, field: EvalField) {
  const values = draftToAssessment(draft);
  if (field === "chiefComplaint") return values.chiefComplaint;
  if (field === "history") return values.summary;
  if (field === "examination") return values.examination;
  if (field === "diagnosis") return values.diagnosis;
  if (field === "medicines") return values.prescription;
  if (field === "advice") return values.advice;
  return `${draft.followUpInDays ?? ""} ${values.followUpAt} ${values.visitOutcome}`;
}

export function scoreDraft(draft: ScribeDraft, item: EvalCase) {
  const wrong: ScoreHit[] = [];
  const missed: ScoreHit[] = [];
  const fields = new Set<EvalField>([
    ...(Object.keys(item.must) as EvalField[]),
    ...(Object.keys(item.mustNot) as EvalField[]),
  ]);
  for (const field of fields) {
    const haystack = fieldText(draft, field).toLowerCase();
    for (const text of item.mustNot[field] ?? []) {
      if (text && haystack.includes(text.toLowerCase())) wrong.push({ id: item.id, field, text });
    }
    for (const text of item.must[field] ?? []) {
      if (text && !haystack.includes(text.toLowerCase())) missed.push({ id: item.id, field, text });
    }
  }
  return { wrong, missed };
}

export function scoreReport(results: Array<{ wrong: ScoreHit[]; missed: ScoreHit[] }>) {
  const byField: Record<string, { wrong: number; missed: number }> = {};
  let wrong = 0;
  let missed = 0;
  for (const result of results) {
    for (const hit of result.wrong) {
      wrong += 1;
      byField[hit.field] ??= { wrong: 0, missed: 0 };
      byField[hit.field]!.wrong += 1;
    }
    for (const hit of result.missed) {
      missed += 1;
      byField[hit.field] ??= { wrong: 0, missed: 0 };
      byField[hit.field]!.missed += 1;
    }
  }
  return { cases: results.length, wrong, missed, byField };
}
