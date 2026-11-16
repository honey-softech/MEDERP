import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireScribeAppointment, scribeSessionFor, scribeSessionView } from "@/lib/scribe/access";
import { SCRIBE_MAX_SEGMENTS, SCRIBE_MAX_TRANSCRIPT_CHARS } from "@/lib/scribe/limits";
import { suggestSpokenMedicines } from "@/lib/scribe/match-medicine";
import { withoutPromptEcho } from "@/lib/scribe/medicine-match";
import { ScribeProviderError, translateUtterance, transcribeModel } from "@/lib/scribe/openai";

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

  const limited = checkRateLimit(`scribe-seg:${gate.actor.id}`, { limit: 400, windowMs: 10 * 60_000 });
  if (!limited.ok) return tooMany(limited.retryAfterSec);

  const body = (await request.json().catch(() => null)) as { sessionId?: unknown; seq?: unknown; text?: unknown } | null;
  const sessionId = String(body?.sessionId ?? "");
  const seq = Number(body?.seq);
  const text = withoutPromptEcho(String(body?.text ?? "")).slice(0, 4_000);
  if (!Number.isInteger(seq) || seq < 1 || !text) {
    return NextResponse.json({ error: "Send the next line of the conversation." }, { status: 400 });
  }

  const session = await scribeSessionFor(gate.actor.hospitalId, gate.appointment.id, sessionId);
  if (!session) {
    return NextResponse.json({ error: "No recording was found for this visit." }, { status: 404 });
  }
  if (session.status !== "RECORDING" && session.status !== "TRANSCRIBED") {
    return NextResponse.json({ error: "This recording is already closed.", chunkCount: session.chunkCount }, { status: 409 });
  }
  if (seq <= session.chunkCount) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      transcript: session.transcript ?? "",
      translation: session.translation ?? "",
      chunkCount: session.chunkCount,
      session: scribeSessionView(session),
    });
  }
  if (session.chunkCount >= SCRIBE_MAX_SEGMENTS) {
    return NextResponse.json(
      { error: "This consultation is long enough. Stop and fill the assessment.", chunkCount: session.chunkCount },
      { status: 413 },
    );
  }

  let english = text;
  try {
    const translated = await translateUtterance(text);
    if (translated) english = translated;
  } catch (error) {
    console.error("scribe segment translation failed", error instanceof Error ? error.name : "error");
    english = text;
  }

  const suggestions = await suggestSpokenMedicines(text, gate.actor.hospitalId, gate.appointment.doctorId).catch(() => [] as string[]);

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const current = await tx.consultScribeSession.findFirst({
        where: { id: session.id, hospitalId: gate.actor.hospitalId, appointmentId: gate.appointment.id },
      });
      if (!current) return { error: "missing" as const };
      if (current.status !== "RECORDING" && current.status !== "TRANSCRIBED") return { error: "closed" as const, session: current };
      if (seq <= current.chunkCount) return { session: current, duplicate: true as const };
      if (seq !== current.chunkCount + 1) return { error: "order" as const, session: current };
      if (current.chunkCount >= SCRIBE_MAX_SEGMENTS) return { error: "long" as const, session: current };
      const transcript = joinText(current.transcript, text);
      const translation = joinText(current.translation, english);
      const updated = await tx.consultScribeSession.update({
        where: { id: current.id },
        data: {
          transcript,
          translation,
          chunkCount: current.chunkCount + 1,
          status: "TRANSCRIBED",
          transcribeModel: transcribeModel(),
        },
      });
      return { session: updated, english };
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
    if (error instanceof ScribeProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("scribe segment save failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Could not save that line of the conversation." }, { status: 500 });
  }
}
