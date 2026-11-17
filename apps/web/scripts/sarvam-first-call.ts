import { createReadStream, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SarvamAIClient, SarvamAIError } from "sarvamai";

type Model = "saaras:v4" | "saaras:v3";

function loadEnv(path: string) {
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
}

function redact(message: string) {
  return message.replace(/sk[-_][A-Za-z0-9_-]+/g, "sk_[redacted]");
}

async function transcribe(client: SarvamAIClient, filePath: string, model: Model, language: string) {
  return client.speechToText.transcribe({
    file: createReadStream(filePath),
    model,
    mode: "codemix",
    language_code: language as "unknown",
  });
}

async function main() {
  const envPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../.env");
  loadEnv(envPath);
  const filePath = process.argv[2];
  const language = process.argv[3] || "unknown";
  if (!filePath) {
    console.error("Usage: tsx scripts/sarvam-first-call.ts <audio> [language_code]");
    process.exit(1);
  }
  if (!process.env.SARVAM_API_KEY?.trim()) {
    console.error("SARVAM_API_KEY is missing.");
    process.exit(1);
  }

  const client = new SarvamAIClient();
  try {
    const result = await transcribe(client, filePath, "saaras:v4", language);
    console.log(result.transcript ?? "");
    console.log("model=saaras:v4");
  } catch (error) {
    if (error instanceof SarvamAIError && error.statusCode === 400) {
      try {
        const result = await transcribe(client, filePath, "saaras:v3", language);
        console.log(result.transcript ?? "");
        console.log("model=saaras:v3");
        return;
      } catch (again) {
        console.error(redact(again instanceof Error ? again.message : "Sarvam request failed."));
        process.exit(1);
      }
    }
    console.error(redact(error instanceof Error ? error.message : "Sarvam request failed."));
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(redact(error instanceof Error ? error.message : "Sarvam request failed."));
  process.exit(1);
});
