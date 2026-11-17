import { describe, expect, it } from "vitest";
import { scoreSttReport, scoreTranscript } from "@/lib/scribe/eval/stt";

describe("speech-to-text comparison", () => {
  it("counts missed medicine names and symptoms", () => {
    const row = scoreTranscript(
      { id: "fever", medicines: ["dolo 650", "crocin"], symptoms: ["headache", "cough"] },
      "Headache for two days. Give dolo 650.",
    );
    expect(row.missedMedicines).toEqual(["crocin"]);
    expect(row.missedSymptoms).toEqual(["cough"]);
    expect(scoreSttReport([row])).toMatchObject({ clips: 1, wrongMedicines: 1, missedSymptoms: 1 });
  });
});
