import { describe, expect, it } from "vitest";
import { parseScribeDraft } from "@/lib/scribe/draft-schema";
import { EVAL_CASES, EVAL_PATTERNS, type EvalLanguage } from "@/lib/scribe/eval/cases";
import { scoreDraft, scoreReport } from "@/lib/scribe/eval/score";
import { verifyEvidence } from "@/lib/scribe/evidence";

describe("scribe eval set", () => {
  it("covers the hard patterns in several languages", () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(60);
    expect(EVAL_CASES.length).toBeLessThanOrEqual(100);
    expect(new Set(EVAL_CASES.map((item) => item.id)).size).toBe(EVAL_CASES.length);
    for (const pattern of EVAL_PATTERNS) {
      expect(EVAL_CASES.some((item) => item.pattern === pattern)).toBe(true);
    }
    const languages = new Set<EvalLanguage>(EVAL_CASES.map((item) => item.language));
    expect(languages).toEqual(new Set(["en", "ta", "hi", "mixed"]));
    for (const item of EVAL_CASES) {
      expect(item.transcript.trim().length).toBeGreaterThan(10);
      expect(Object.keys(item.must).length + Object.keys(item.mustNot).length).toBeGreaterThan(0);
    }
  });

  it("counts a wrong fill and a miss separately", () => {
    const parsed = parseScribeDraft({
      chiefComplaint: "Headache",
      history: "For 2 days",
      examination: "",
      diagnoses: ["Viral infection"],
      medicines: [],
      advice: "",
      followUpInDays: null,
      outcome: "",
      uncertainFields: [],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const item = EVAL_CASES.find((entry) => entry.id === "teach-climate");
    expect(item).toBeTruthy();
    if (!item) return;
    const scored = scoreDraft(parsed.draft, item);
    expect(scored.wrong.map((hit) => hit.text)).toContain("viral");
    expect(scored.missed.map((hit) => hit.text)).toContain("migraine");
    expect(scoreReport([{ wrong: scored.wrong, missed: scored.missed }]).wrong).toBeGreaterThan(0);
  });

  it("drops the climate sentence from the diagnosis when it is labelled as teaching", () => {
    const item = EVAL_CASES.find((entry) => entry.id === "teach-climate");
    expect(item).toBeTruthy();
    if (!item) return;
    const parsed = parseScribeDraft({
      chiefComplaint: [{ text: "Headache", quote: "headache for two days", kind: "patient_said" }],
      history: [{ text: "For 2 days", quote: "headache for two days", kind: "patient_said" }],
      examination: [],
      diagnoses: [
        {
          text: "Viral infection",
          quote: "Climate change will lead to viral infections and bacterial infections",
          kind: "general_statement",
        },
        { text: "Migraine", quote: "This is migraine", kind: "this_patient" },
      ],
      medicines: [],
      advice: [],
      followUpInDays: null,
      followUpQuote: "",
      followUpKind: "question",
      outcome: "",
      uncertainFields: [],
      missingFields: [],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const draft = verifyEvidence(parsed.draft, item.transcript);
    const scored = scoreDraft(draft, item);
    expect(scored.wrong).toEqual([]);
    expect(scored.missed).toEqual([]);
  });
});
