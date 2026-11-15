import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeAudioMime } from "@/lib/scribe/audio";
import { requireScribeAppointment, scribeSessionFor, scribeSessionView } from "@/lib/scribe/access";
import { SCRIBE_MAX_CHUNK_BYTES, SCRIBE_MAX_CHUNKS, SCRIBE_MAX_TRANSCRIPT_CHARS } from "@/lib/scribe/limits";
import { ScribeProviderError, transcribeAudio, translateUtterance, transcribeModel } from "@/lib/scribe/openai";

type Ctx = { params: Promise<{ id: string }> };

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many scribe requests. Wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

function joinTranscript(current: string | null, addition: string) {
  const next = addition.trim();
  if (!next) return (current ?? "").trim();
  const prev = (current ?? "").trim();
  return (prev ? `${prev}\n${next}` : next).slice(0, SCRIBE_MAX_TRANSCRIPT_CHARS);
}

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  const gate = await requireScribeAppointment(id);
  if (!gate.ok) return gate.response;

  const limited = checkRateLimit(`scribe-tx:${gate.actor.id}`, { limit: 160, windowMs: 10 * 60_000 });
  if (!limited.ok) return tooMany(limited.retryAfterSec);

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const sessionId = String(form?.get("sessionId") ?? "");
  const seq = Number(form?.get("seq"));
  if (!(audio instanceof Blob) || !Number.isInteger(seq) || seq < 1) {
    return NextResponse.json({ error: "Send the next part of the recording." }, { status: 400 });
  }

  const mime = normalizeAudioMime(audio.type || "audio/webm");
  if (!mime) {
    return NextResponse.json({ error: "That recording format is not supported." }, { status: 400 });
  }
  if (audio.size > SCRIBE_MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: "That part of the recording is too large." }, { status: 413 });
  }

  const session = await scribeSessionFor(gate.actor.hospitalId, gate.appointment.id, sessionId);
  if (!session) {
    return NextResponse.json({ error: "No recording was found for this visit." }, { status: 404 });
  }
  if (session.status !== "RECORDING" && session.status !== "TRANSCRIBED") {
    return NextResponse.json({ error: "This recording is already closed." }, { status: 409 });
  }

  let text = "";
  let translated = "";
  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    text = await transcribeAudio({ bytes, mime });
    if (text) {
      try {
        translated = await translateUtterance(text);
      } catch (error) {
        console.error("scribe live translation failed", error instanceof Error ? error.name : "error");
        translated = text;
      }
    }
  } catch (error) {
    if (error instanceof ScribeProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("scribe transcribe failed");
    return NextResponse.json({ error: "Could not transcribe that part of the conversation." }, { status: 502 });
  }

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const current = await tx.consultScribeSession.findFirst({
        where: { id: session.id, hospitalId: gate.actor.hospitalId, appointmentId: gate.appointment.id },
      });
      if (!current) return { error: "missing" as const };
      if (current.status !== "RECORDING" && current.status !== "TRANSCRIBED") return { error: "closed" as const };
      if (seq === current.chunkCount && current.chunkCount > 0) return { session: current, duplicate: true as const };
      if (seq !== current.chunkCount + 1) return { error: "order" as const, session: current };
      if (current.chunkCount >= SCRIBE_MAX_CHUNKS) return { error: "long" as const, session: current };
      if (text && (current.transcript?.length ?? 0) >= SCRIBE_MAX_TRANSCRIPT_CHARS) {
        return { error: "long" as const, session: current };
      }
      const transcript = joinTranscript(current.transcript, text);
      const translation = joinTranscript(current.translation, translated || text);
      const updated = await tx.consultScribeSession.update({
        where: { id: current.id },
        data: {
          transcript: transcript || null,
          translation: translation || null,
          chunkCount: current.chunkCount + 1,
          status: transcript ? "TRANSCRIBED" : current.status,
          transcribeModel: transcribeModel(),
        },
      });
      return { session: updated };
    });

    if ("error" in saved && saved.error === "long") {
      return NextResponse.json(
        {
          error: "This consultation is long enough. Draft the note from what was captured.",
          transcript: saved.session?.transcript ?? "",
          chunkCount: saved.session?.chunkCount ?? session.chunkCount,
        },
        { status: 413 },
      );
    }
    if ("error" in saved && saved.error === "order") {
      return NextResponse.json(
        {
          error: "Send the next part of the recording.",
          transcript: saved.session?.transcript ?? "",
          chunkCount: saved.session?.chunkCount ?? 0,
        },
        { status: 409 },
      );
    }
    if ("error" in saved) {
      return NextResponse.json({ error: "This recording is already closed." }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      duplicate: "duplicate" in saved,
      transcript: saved.session.transcript ?? "",
      chunkCount: saved.session.chunkCount,
      session: scribeSessionView(saved.session),
    });
  } catch (error) {
    console.error("scribe transcript save failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Could not save that part of the conversation." }, { status: 500 });
  }
}
