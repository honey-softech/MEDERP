import { describe, expect, it } from "vitest";
import { rankMedicineCandidates, transliterateTamil } from "@/lib/scribe/medicine-match";
import { rankPrescribedNames, transcribeVocabularyPrompt } from "@/lib/scribe/vocabulary";

const CATALOG = ["Paracetamol 500 Tablet", "Pantoprazole 40 Tablet", "Dolo 650 Tablet", "Azithromycin 500 Tablet"];

describe("tamil medicine matching", () => {
  it("turns a Tamil drug name into Latin letters", () => {
    expect(transliterateTamil("பாராசிட்டமால்").toLowerCase()).toContain("paa");
  });

  it("uses the catalog spelling when the Tamil name and strength match one medicine", () => {
    const ranked = rankMedicineCandidates({
      spoken: "பாராசிட்டமால் 500 mg",
      candidates: CATALOG,
    });
    expect(ranked).toEqual({
      name: "Paracetamol 500 Tablet",
      matched: true,
      confidence: "high",
      alternatives: [],
    });
  });

  it("does not invent a strength and offers the close catalog names instead", () => {
    const ranked = rankMedicineCandidates({
      spoken: "பாராசிட்டமால்",
      candidates: CATALOG,
    });
    expect(ranked.confidence).toBe("low");
    expect(ranked.name).toBe("பாராசிட்டமால்");
    expect(ranked.alternatives).toContain("Paracetamol 500 Tablet");
    expect(ranked.alternatives).not.toContain("Pantoprazole 40 Tablet");
  });

  it("accepts a catalog choice only when that exact name was offered", () => {
    expect(
      rankMedicineCandidates({
        spoken: "டோலோ",
        catalogChoice: "Dolo 650 Tablet",
        candidates: CATALOG,
      }),
    ).toMatchObject({ name: "Dolo 650 Tablet", confidence: "high", matched: true });

    expect(
      rankMedicineCandidates({
        spoken: "டோலோ",
        catalogChoice: "Not In The List",
        candidates: CATALOG,
      }).confidence,
    ).not.toBe("high");
  });

  it("rejects a catalog choice whose strength was not the one spoken", () => {
    const ranked = rankMedicineCandidates({
      spoken: "dolo 500 mg",
      catalogChoice: "Dolo 650 Tablet",
      candidates: CATALOG,
    });
    expect(ranked.name).not.toBe("Dolo 650 Tablet");
  });
});

describe("doctor medicine vocabulary", () => {
  it("ranks the tablets the doctor writes most often", () => {
    expect(
      rankPrescribedNames([
        "Dolo 650 Tablet || 1-0-1 AF for 3 days\nParacetamol 500 Tablet || 1-0-1",
        "Dolo 650 Tablet || 1-0-1",
        "Azithromycin 500 Tablet",
      ]),
    ).toEqual(["Dolo 650 Tablet", "Azithromycin 500 Tablet", "Paracetamol 500 Tablet"]);
  });

  it("puts the doctor's medicine names into the transcribe prompt", () => {
    expect(transcribeVocabularyPrompt(["Dolo 650 Tablet", "Paracetamol 500 Tablet"])).toContain("Dolo 650 Tablet");
  });
});
