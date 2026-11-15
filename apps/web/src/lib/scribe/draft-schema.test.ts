import { describe, expect, it } from "vitest";
import { audioFilename, normalizeAudioMime } from "@/lib/scribe/audio";
import {
  catalogNameForSpoken,
  draftToAssessment,
  fieldsToCheck,
  medicineNotes,
  missingLabels,
  parseScribeDraft,
  prescriptionFromDraft,
  resolveAiAssisted,
  type ScribeDraft,
} from "@/lib/scribe/draft-schema";

function medicine(overrides: Partial<ScribeDraft["medicines"][number]> = {}): ScribeDraft["medicines"][number] {
  return {
    name: "Paracetamol 500",
    spokenName: "Paracetamol 500",
    morning: true,
    afternoon: false,
    night: true,
    beforeFood: false,
    afterFood: true,
    durationDays: 5,
    note: "",
    uncertain: false,
    matched: true,
    ...overrides,
  };
}

function draft(overrides: Partial<ScribeDraft> = {}): ScribeDraft {
  return {
    chiefComplaint: "Fever and cough",
    history: "Fever for 2 days with dry cough.",
    examination: "Throat congested.",
    diagnoses: ["Upper respiratory tract infection"],
    medicines: [medicine()],
    advice: "Rest and fluids",
    followUpInDays: 5,
    outcome: "FOLLOW_UP",
    uncertainFields: [],
    ...overrides,
  };
}

describe("scribe draft", () => {
  it("maps a draft onto the assessment fields and a pharmacy line", () => {
    const parsed = parseScribeDraft(draft());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const values = draftToAssessment(parsed.draft, new Date(2026, 10, 15));
    expect(values.chiefComplaint).toBe("Fever and cough");
    expect(values.summary).toBe("Fever for 2 days with dry cough.");
    expect(values.examination).toBe("Throat congested.");
    expect(values.diagnosis).toBe("Upper respiratory tract infection");
    expect(values.advice).toBe("Rest and fluids");
    expect(values.followUpAt).toBe("2026-11-20");
    expect(values.visitOutcome).toBe("FOLLOW_UP");
    expect(values.prescription).toBe("Paracetamol 500 || 1-0-1 AF for 5 days");
  });

  it("keeps unmentioned fields empty and omits a timing that was not said", () => {
    const parsed = parseScribeDraft(
      draft({
        chiefComplaint: "",
        history: "",
        examination: "",
        diagnoses: [],
        medicines: [medicine({ morning: false, afternoon: false, night: false, afterFood: false, durationDays: null, note: "SOS" })],
        advice: "",
        followUpInDays: null,
        outcome: "",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const values = draftToAssessment(parsed.draft, new Date(2026, 10, 15));
    expect(values.chiefComplaint).toBe("");
    expect(values.summary).toBe("");
    expect(values.diagnosis).toBe("");
    expect(values.followUpAt).toBe("");
    expect(values.visitOutcome).toBe("");
    expect(values.prescription).toBe("Paracetamol 500 || SOS");
    expect(prescriptionFromDraft(parsed.draft)).toBe(values.prescription);
  });

  it("rejects a draft whose medicines are not a list", () => {
    const parsed = parseScribeDraft({ ...draft(), medicines: "Paracetamol" });
    expect(parsed.ok).toBe(false);
  });

  it("rejects a draft that is missing required fields", () => {
    expect(parseScribeDraft(null).ok).toBe(false);
    expect(parseScribeDraft({ chiefComplaint: "Fever" }).ok).toBe(false);
  });

  it("drops an impossible duration and flags the medicine", () => {
    const parsed = parseScribeDraft(draft({ medicines: [medicine({ durationDays: 400 })] }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.medicines[0]?.durationDays).toBeNull();
    expect(parsed.draft.medicines[0]?.uncertain).toBe(true);
    expect(medicineNotes(parsed.draft.medicines[0]!)).toBe("1-0-1 AF");
  });

  it("does not write both before-food and after-food on one line", () => {
    expect(medicineNotes(medicine({ beforeFood: true, afterFood: true }))).toBe("1-0-1 for 5 days");
  });

  it("lists unheard topics in the order the doctor should ask them", () => {
    expect(missingLabels(["followUp", "medicines", "chiefComplaint", "not-a-field"])).toEqual([
      "chief complaint",
      "medicines and dose",
      "follow-up",
    ]);
  });

  it("flags the history and any uncertain medicine for the doctor to check", () => {
    const flags = fieldsToCheck(
      draft({
        uncertainFields: ["history", "not-a-field"],
        medicines: [medicine({ uncertain: true })],
      }),
    );
    expect(flags).toEqual(["summary", "prescription"]);
  });
});

describe("catalog spelling", () => {
  it("uses the catalog name when the spoken name is a prefix of one result", () => {
    expect(catalogNameForSpoken("dolo 650", ["Dolo 650 Tablet", "Dolo 650 Suspension"])).toEqual({
      name: "Dolo 650 Tablet",
      matched: true,
    });
  });

  it("keeps free text when nothing in the catalog matches", () => {
    expect(catalogNameForSpoken("cough syrup", ["Paracetamol 500 Tablet"])).toEqual({
      name: "cough syrup",
      matched: false,
    });
  });

  it("does not match a one-letter fragment", () => {
    expect(catalogNameForSpoken("p", ["Paracetamol 500 Tablet"]).matched).toBe(false);
  });
});

describe("audio upload type", () => {
  it("strips codec parameters and names the file", () => {
    expect(normalizeAudioMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(audioFilename("audio/webm")).toBe("chunk.webm");
    expect(normalizeAudioMime("audio/mp4")).toBe("audio/mp4");
    expect(normalizeAudioMime("text/plain")).toBeNull();
  });
});

describe("ai assisted approval", () => {
  it("marks a typed approval only after a scribe draft was applied", () => {
    expect(
      resolveAiAssisted({ approve: true, entryMode: "TYPED", sessionApplied: true, previous: false }),
    ).toBe(true);
    expect(
      resolveAiAssisted({ approve: true, entryMode: "TYPED", sessionApplied: false, previous: false }),
    ).toBe(false);
    expect(
      resolveAiAssisted({ approve: true, entryMode: "HANDWRITTEN", sessionApplied: true, previous: false }),
    ).toBe(false);
    expect(
      resolveAiAssisted({ approve: false, entryMode: "TYPED", sessionApplied: true, previous: true }),
    ).toBe(true);
  });
});
