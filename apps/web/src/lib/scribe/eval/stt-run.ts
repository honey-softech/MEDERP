import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAudioMime } from "@/lib/scribe/audio";
import { scoreSttReport, scoreTranscript, type SttExpect } from "@/lib/scribe/eval/stt";
import { transcribeAudio } from "@/lib/scribe/openai";
import { sarvamConfigured, transcribeClip } from "@/lib/scribe/sarvam";

function loadEnv(path: string) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // The folder can still be scored when the process already has the keys.
  }
}

function expectFrom(id: string, raw: unknown): SttExpect {
  const body = raw && typeof raw === "object" ? (raw as { medicines?: unknown; symptoms?: unknown }) : {};
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  return { id, medicines: list(body.medicines), symptoms: list(body.symptoms) };
}

async function main() {
  loadEnv(resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../.env"));
  const folder = process.argv[2];
  if (!folder) {
    console.error("Usage: npm run scribe:eval-stt -- <folder of audio + matching json>");
    console.error("Each clip is name.wav (or webm/mp4/mp3) plus name.json with medicines and symptoms.");
    console.error("Sarvam stays available when SARVAM_API_KEY is set. Treat it as the default only after this report is at least as good as OpenAI on real Tamil and mixed clinic clips.");
    process.exit(1);
  }

  const dir = resolve(folder);
  const names = (await readdir(dir)).filter((name) => /\.(wav|webm|mp4|m4a|mp3|ogg)$/i.test(name));
  if (names.length === 0) {
    console.log(JSON.stringify({ clips: 0, note: "No audio clips in that folder." }, null, 2));
    return;
  }

  if (!process.env.OPENAI_API_KEY?.trim() && !sarvamConfigured()) {
    console.error("Set OPENAI_API_KEY and SARVAM_API_KEY before comparing clips.");
    process.exit(1);
  }

  const openaiRows = [];
  const sarvamRows = [];
  for (const name of names) {
    const id = basename(name).replace(/\.[^.]+$/, "");
    const audioPath = join(dir, name);
    const bytes = new Uint8Array(await readFile(audioPath));
    const mime = normalizeAudioMime(name.endsWith(".mp3") ? "audio/mpeg" : `audio/${name.split(".").pop()}`) || "audio/wav";
    let expect: SttExpect = { id, medicines: [], symptoms: [] };
    try {
      expect = expectFrom(id, JSON.parse(await readFile(join(dir, `${id}.json`), "utf8")));
    } catch {
      expect = { id, medicines: [], symptoms: [] };
    }
    if (process.env.OPENAI_API_KEY?.trim()) {
      const transcript = await transcribeAudio({ bytes, mime, prompt: "" });
      openaiRows.push(scoreTranscript(expect, transcript));
    }
    if (sarvamConfigured()) {
      const result = await transcribeClip({ bytes, mime, language: "auto", durationMs: 15_000 });
      sarvamRows.push(scoreTranscript(expect, result.transcript));
    }
  }

  console.log(
    JSON.stringify(
      {
        openai: scoreSttReport(openaiRows),
        sarvam: scoreSttReport(sarvamRows),
        note: "Compare wrongMedicines and missedSymptoms. Real clinic clips are required before relying on Sarvam for Tamil and mixed speech.",
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The speech comparison could not be run.");
  process.exit(1);
});
