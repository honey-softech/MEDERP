import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireScribeAppointment, scribeSessionFor } from "@/lib/scribe/access";
import { createRealtimeTranscriptionSecret, ScribeProviderError, scribeConfigured, scribeNotConfiguredMessage, type RealtimeLanguage } from "@/lib/scribe/openai";
import { doctorMedicineVocabulary, transcribeVocabularyPrompt } from "@/lib/scribe/vocabulary";

type Ctx = { params: Promise<{ id: string }> };

const LANGUAGES = new Set<RealtimeLanguage>(["auto", "en", "ta", "hi", "kn", "ml"]);

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many scribe requests. Wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  const gate = await requireScribeAppointment(id);
  if (!gate.ok) return gate.response;

  const limited = checkRateLimit(`scribe-live:${gate.actor.id}`, { limit: 30, windowMs: 60 * 60_000 });
  if (!limited.ok) return tooMany(limited.retryAfterSec);
  if (!scribeConfigured()) {
    return NextResponse.json({ error: scribeNotConfiguredMessage() }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { sessionId?: unknown; language?: unknown } | null;
  const language = LANGUAGES.has(body?.language as RealtimeLanguage) ? (body?.language as RealtimeLanguage) : "auto";
  const session = await scribeSessionFor(gate.actor.hospitalId, gate.appointment.id, String(body?.sessionId ?? ""));
  if (!session || session.status === "DISCARDED") {
    return NextResponse.json({ error: "No recording was found for this visit." }, { status: 404 });
  }
  if (session.status !== "RECORDING" && session.status !== "TRANSCRIBED") {
    return NextResponse.json({ error: "This recording is already closed." }, { status: 409 });
  }

  try {
    const vocabulary = await doctorMedicineVocabulary(gate.actor.hospitalId, gate.appointment.doctorId);
    const secret = await createRealtimeTranscriptionSecret({
      prompt: transcribeVocabularyPrompt(vocabulary),
      language,
    });
    return NextResponse.json({ ok: true, clientSecret: secret.clientSecret, expiresAt: secret.expiresAt });
  } catch (error) {
    if (error instanceof ScribeProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("scribe realtime token failed");
    return NextResponse.json({ error: "Could not start live transcription." }, { status: 502 });
  }
}
