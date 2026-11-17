import { EVAL_CASES } from "@/lib/scribe/eval/cases";
import { scoreDraft, scoreReport } from "@/lib/scribe/eval/score";
import { parseScribeDraft } from "@/lib/scribe/draft-schema";
import { verifyEvidence } from "@/lib/scribe/evidence";
import { draftConsult, openAiApiKey } from "@/lib/scribe/openai";

async function main() {
  if (!openAiApiKey()) {
    console.error("Set OPENAI_API_KEY to score the scribe eval set.");
    process.exit(1);
  }

  const results = [];
  for (const item of EVAL_CASES) {
    const raw = await draftConsult(item.transcript);
    const parsed = parseScribeDraft(raw);
    if (!parsed.ok) {
      console.error(`${item.id}: ${parsed.error}`);
      results.push({
        wrong: [{ id: item.id, field: "diagnosis" as const, text: "unreadable draft" }],
        missed: [],
      });
      continue;
    }
    const draft = verifyEvidence(parsed.draft, item.transcript);
    const scored = scoreDraft(draft, item);
    results.push(scored);
    for (const hit of scored.wrong) console.error(`wrong ${hit.id} ${hit.field}: ${hit.text}`);
    for (const hit of scored.missed) console.error(`missed ${hit.id} ${hit.field}: ${hit.text}`);
  }

  const report = scoreReport(results);
  console.log(JSON.stringify(report, null, 2));
  if (report.wrong > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The eval could not be run.");
  process.exit(1);
});
