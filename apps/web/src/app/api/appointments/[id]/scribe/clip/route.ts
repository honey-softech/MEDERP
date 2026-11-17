import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeAudioMime } from "@/lib/scribe/audio";
import { requireScribeAppointment, scribeSessionFor, scribeSessionView } from "@/lib/scribe/access";
import { SCRIBE_MAX_CHUNK_BYTES, SCRIBE_MAX_SEGMENTS, SCRIBE_MAX_TRANSCRIPT_CHARS } from "@/lib/scribe/limits";
import { suggestSpokenMedicines } from "@/lib/scribe/match-medicine";
import { withoutPromptEcho } from "@/lib/scribe/medicine-match";
import { ScribeProviderError } from "@/lib/scribe/openai";
import { decideClipSeq, listenLanguage, transcribeClip } from "@/lib/scribe/sarvam";

type Ctx = { params: Promise<{ id: string }> };

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many scribe requests. Wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

function joinText(current: string | null, addition: string) {
  const next = addition.trim();
  if (!next) return (current ?? "").trim();
  const prev = (current ?? "").trim();
  return (prev ? `${prev}\n${next}` : next).slice(0, SCRIBE_MAX_TRANSCRIPT_CHARS);
}

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  const gate = await requireScribeAppointment(id);
  if (!gate.ok) return gate.response;

  const limited = checkRateLimit(`scribe-clip:${gate.actor.id}`, { limit: 60, windowMs: 10 * 60_000 });
  if (!limited.ok) return tooMany(limited.retryAfterSec);

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const sessionId = String(form?.get("sessionId") ?? "");
  const seq = Number(form?.get("seq"));
  const durationMs = Number(form?.get("durationMs"));
  const language = listenLanguage(String(form?.get("language") ?? "auto"));
  if (!(audio instanceof Blob) || !Number.isInteger(seq) || seq < 1) {
    return NextResponse.json({ error: "Send the next line of the conversation." }, { status: 400 });
  }
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 30_000) {
    return NextResponse.json({ error: "That clip is too long." }, { status: 400 });
  }
  const mime = normalizeAudioMime(audio.type || "audio/webm");
  if (!mime) return NextResponse.json({ error: "That recording format is not supported." }, { status: 400 });
  if (audio.size > SCRIBE_MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: "That part of the recording is too large." }, { status: 413 });
  }

  const session = await scribeSessionFor(gate.actor.hospitalId, gate.appointment.id, sessionId);
  if (!session) return NextResponse.json({ error: "No recording was found for this visit." }, { status: 404 });
  if (session.status !== "RECORDING" && session.status !== "TRANSCRIBED") {
    return NextResponse.json({ error: "This recording is already closed.", chunkCount: session.chunkCount }, { status: 409 });
  }

  const decision = decideClipSeq(seq, session.chunkCount, SCRIBE_MAX_SEGMENTS);
  if (decision === "duplicate") {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      transcript: session.transcript ?? "",
      translation: session.translation ?? "",
      chunkCount: session.chunkCount,
      session: scribeSessionView(session),
    });
  }
  if (decision === "long") {
    return NextResponse.json(
      { error: "This consultation is long enough. Stop and fill the assessment.", chunkCount: session.chunkCount },
      { status: 413 },
    );
  }
  if (decision === "order" || decision === "invalid") {
    return NextResponse.json({ error: "Send the next line of the conversation.", chunkCount: session.chunkCount }, { status: 409 });
  }

  let transcriptText = "";
  let model = "";
  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const result = await transcribeClip({ bytes, mime, language, durationMs });
    transcriptText = withoutPromptEcho(result.transcript).slice(0, 4_000);
    model = result.model;
  } catch (error) {
    if (error instanceof ScribeProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("scribe clip failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Could not transcribe that part of the conversation." }, { status: 502 });
  }

  if (!transcriptText) {
    return NextResponse.json({
      ok: true,
      empty: true,
      transcript: session.transcript ?? "",
      translation: session.translation ?? "",
      chunkCount: session.chunkCount,
      session: scribeSessionView(session),
    });
  }

  const suggestions = await suggestSpokenMedicines(transcriptText, gate.actor.hospitalId, gate.appointment.doctorId).catch(() => [] as string[]);

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const current = await tx.consultScribeSession.findFirst({
        where: { id: session.id, hospitalId: gate.actor.hospitalId, appointmentId: gate.appointment.id },
      });
      if (!current) return { error: "missing" as const };
      if (current.status !== "RECORDING" && current.status !== "TRANSCRIBED") return { error: "closed" as const, session: current };
      const again = decideClipSeq(seq, current.chunkCount, SCRIBE_MAX_SEGMENTS);
      if (again === "duplicate") return { session: current, duplicate: true as const };
      if (again === "long") return { error: "long" as const, session: current };
      if (again !== "ok") return { error: "order" as const, session: current };
      const transcript = joinText(current.transcript, transcriptText);
      const updated = await tx.consultScribeSession.update({
        where: { id: current.id },
        data: {
          transcript,
          translation: joinText(current.translation, transcriptText),
          chunkCount: current.chunkCount + 1,
          status: "TRANSCRIBED",
          transcribeModel: model,
        },
      });
      return { session: updated, english: transcriptText };
    });

    if ("error" in saved && saved.error === "order") {
      return NextResponse.json(
        { error: "Send the next line of the conversation.", chunkCount: saved.session?.chunkCount ?? 0 },
        { status: 409 },
      );
    }
    if ("error" in saved && saved.error === "long") {
      return NextResponse.json(
        { error: "This consultation is long enough. Stop and fill the assessment.", chunkCount: saved.session?.chunkCount ?? session.chunkCount },
        { status: 413 },
      );
    }
    if ("error" in saved) {
      return NextResponse.json({ error: "This recording is already closed." }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      duplicate: "duplicate" in saved,
      english: "english" in saved ? saved.english : saved.session.translation ?? "",
      transcript: saved.session.transcript ?? "",
      translation: saved.session.translation ?? "",
      chunkCount: saved.session.chunkCount,
      suggestions,
      session: scribeSessionView(saved.session),
    });
  } catch (error) {
    console.error("scribe clip save failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Could not save that line of the conversation." }, { status: 500 });
  }
}
