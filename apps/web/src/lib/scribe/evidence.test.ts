import { describe, expect, it } from "vitest";
import { parseScribeDraft, type ScribeMedicine } from "@/lib/scribe/draft-schema";
import { quoteMentionsSpoken, quoteSupportsNumber, verifyEvidence } from "@/lib/scribe/evidence";
import { SCRIBE_SYSTEM_PROMPT, extractionSpendInr, scribeModelFrom } from "@/lib/scribe/openai";

function medicine(overrides: Partial<ScribeMedicine> = {}): ScribeMedicine {
  return {
    name: "Dolo 650",
    spokenName: "Dolo 650",
    morning: true,
    afternoon: false,
    night: true,
    beforeFood: false,
    afterFood: true,
    durationDays: 3,
    note: "",
    uncertain: false,
    matched: false,
    alternatives: [],
    quote: "dolo 650 morning and night for 3 days",
    kind: "this_patient",
    ...overrides,
  };
}

function checked(value: Record<string, unknown>, transcript: string) {
  const parsed = parseScribeDraft({
    chiefComplaint: [],
    history: [],
    examination: [],
    diagnoses: [],
    medicines: [],
    advice: [],
    followUpInDays: null,
    followUpQuote: "",
    followUpKind: "question",
    outcome: "",
    uncertainFields: [],
    missingFields: [],
    ...value,
  });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.error);
  return verifyEvidence(parsed.draft, transcript);
}

const climate =
  "Climate change will lead to viral infections and bacterial infections. This patient has a headache for two days. This is migraine.";

describe("scribe evidence", () => {
  it("drops teaching, questions, and guesses, and keeps what was said about this patient", () => {
    const draft = checked(
      {
        chiefComplaint: [
          { text: "Headache", quote: "headache for two days", kind: "patient_said" },
          { text: "Viral infection", quote: "Climate change will lead to viral infections and bacterial infections", kind: "general_statement" },
        ],
        history: [{ text: "For 2 days", quote: "headache for two days", kind: "patient_said" }],
        examination: [{ text: "Need a scan", quote: "do you want a scan", kind: "question" }],
        diagnoses: [
          { text: "Viral infection", quote: "Climate change will lead to viral infections and bacterial infections", kind: "general_statement" },
          { text: "Bacterial infection", quote: "the patient might have a bacterial infection", kind: "possibility" },
          { text: "Fever", quote: "no fever", kind: "negated" },
          { text: "Dengue", quote: "I think it is dengue", kind: "patient_said" },
          { text: "Migraine", quote: "This is migraine", kind: "this_patient" },
        ],
        advice: [
          { text: "Rest", quote: "take rest", kind: "this_patient" },
          { text: "Infections rise when the climate changes", quote: "Climate change will lead to viral infections", kind: "general_statement" },
        ],
      },
      `${climate} do you want a scan. no fever. I think it is dengue. take rest.`,
    );
    expect(draft.chiefComplaint).toBe("Headache");
    expect(draft.history).toBe("For 2 days");
    expect(draft.examination).toBe("");
    expect(draft.diagnoses).toEqual(["Migraine"]);
    expect(draft.advice).toContain("Rest");
    expect(draft.advice).toContain("Infections rise when the climate changes");
    expect(draft.sources.diagnosis).toBe("This is migraine");
  });

  it("does not blacklist a phrase when the doctor used it for this patient", () => {
    const draft = checked(
      {
        diagnoses: [
          {
            text: "Viral infection",
            quote: "Climate change will lead to viral infections and bacterial infections",
            kind: "this_patient",
          },
        ],
      },
      climate,
    );
    expect(draft.diagnoses).toEqual(["Viral infection"]);
  });

  it("drops a diagnosis whose quote was never spoken", () => {
    const draft = checked(
      { diagnoses: [{ text: "Migraine", quote: "this is migraine", kind: "this_patient" }] },
      "headache for two days",
    );
    expect(draft.diagnoses).toEqual([]);
  });

  it("drops a conditional medicine and a medicine the doctor did not name", () => {
    const draft = checked(
      {
        medicines: [
          medicine({
            name: "Paracetamol",
            spokenName: "Paracetamol",
            quote: "if the fever continues take paracetamol",
            kind: "possibility",
            durationDays: null,
            morning: false,
            night: false,
            afterFood: false,
          }),
          medicine({
            name: "Dolo 650",
            spokenName: "Dolo 650",
            quote: "headache for two days",
            durationDays: null,
            morning: false,
            night: false,
            afterFood: false,
          }),
        ],
      },
      "if the fever continues take paracetamol. headache for two days.",
    );
    expect(draft.medicines).toEqual([]);
  });

  it("keeps a spoken medicine and removes a dose or duration that was not said", () => {
    const draft = checked(
      {
        medicines: [
          medicine({
            name: "Dolo 650",
            spokenName: "Dolo 650",
            quote: "give dolo for two days",
            durationDays: 5,
          }),
        ],
      },
      "give dolo for two days",
    );
    expect(draft.medicines[0]?.name).toBe("Dolo");
    expect(draft.medicines[0]?.durationDays).toBeNull();
    expect(draft.medicines[0]?.uncertain).toBe(true);
  });

  it("keeps a follow-up number only when the quote says it", () => {
    const kept = checked(
      { followUpInDays: 5, followUpQuote: "come back in five days", followUpKind: "this_patient", outcome: "FOLLOW_UP" },
      "come back in five days",
    );
    expect(kept.followUpInDays).toBe(5);
    expect(kept.outcome).toBe("FOLLOW_UP");

    const dropped = checked(
      { followUpInDays: 7, followUpQuote: "come back soon", followUpKind: "this_patient", outcome: "FOLLOW_UP" },
      "come back soon",
    );
    expect(dropped.followUpInDays).toBeNull();
    expect(dropped.outcome).toBe("FOLLOW_UP");

    const unsupported = checked(
      { followUpInDays: 5, followUpQuote: "patients usually review in five days", followUpKind: "general_statement", outcome: "FOLLOW_UP" },
      "patients usually review in five days",
    );
    expect(unsupported.followUpInDays).toBeNull();
    expect(unsupported.outcome).toBe("");
  });

  it("reads number words in English, Tamil, and Hindi", () => {
    expect(quoteSupportsNumber(2, "for two days")).toBe(true);
    expect(quoteSupportsNumber(2, "ரெண்டு நாள்")).toBe(true);
    expect(quoteSupportsNumber(5, "paanch din")).toBe(true);
    expect(quoteSupportsNumber(5, "for two days")).toBe(false);
    expect(quoteMentionsSpoken("give dolo after food", "Dolo 650")).toBe(true);
    expect(quoteMentionsSpoken("headache for two days", "Dolo")).toBe(false);
  });
});

describe("scribe extraction budget", () => {
  it("keeps preview and final on gpt-4o-mini unless the server overrides them", () => {
    expect(scribeModelFrom({}, "preview")).toBe("gpt-4o-mini");
    expect(scribeModelFrom({}, "final")).toBe("gpt-4o-mini");
    expect(scribeModelFrom({ OPENAI_SCRIBE_MODEL: "gpt-5-mini" }, "final")).toBe("gpt-5-mini");
    expect(scribeModelFrom({ OPENAI_SCRIBE_MODEL: "gpt-5-mini" }, "preview")).toBe("gpt-4o-mini");
  });

  it("stays under one rupee for six previews and the final note", () => {
    const rupees = extractionSpendInr({
      calls: 7,
      inputTokens: 4_000,
      outputTokens: 800,
      usdToInr: 93.92,
    });
    expect(rupees).toBeLessThan(1);
  });

  it("states the evidence rule once and does not special-case one sentence", () => {
    expect(SCRIBE_SYSTEM_PROMPT).toContain("Only this_patient statements from the doctor");
    expect(SCRIBE_SYSTEM_PROMPT.toLowerCase()).not.toContain("climate");
  });
});
