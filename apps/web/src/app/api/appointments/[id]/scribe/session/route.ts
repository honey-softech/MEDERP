import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  latestScribeSession,
  requireScribeAppointment,
  scribeSessionFor,
  scribeSessionView,
} from "@/lib/scribe/access";
import { parseScribeDraft } from "@/lib/scribe/draft-schema";
import { scribeConfigured, scribeModel, scribeNotConfiguredMessage } from "@/lib/scribe/openai";

type Ctx = { params: Promise<{ id: string }> };

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many scribe requests. Wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const gate = await requireScribeAppointment(id);
  if (!gate.ok) return gate.response;
  const session = await latestScribeSession(gate.actor.hospitalId, gate.appointment.id);
  return NextResponse.json({
    configured: scribeConfigured(),
    session: session ? scribeSessionView(session) : null,
  });
}

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  const gate = await requireScribeAppointment(id);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as { action?: unknown; consent?: unknown; sessionId?: unknown; draft?: unknown } | null;
  const action = String(body?.action ?? "");
  const sessionId = String(body?.sessionId ?? "");

  if (action === "start") {
    const limited = checkRateLimit(`scribe-start:${gate.actor.id}`, { limit: 20, windowMs: 60 * 60_000 });
    if (!limited.ok) return tooMany(limited.retryAfterSec);
    if (!scribeConfigured()) {
      return NextResponse.json({ error: scribeNotConfiguredMessage() }, { status: 503 });
    }
    if (body?.consent !== true) {
      return NextResponse.json(
        { error: "Confirm that the patient has agreed to this recording." },
        { status: 400 },
      );
    }

    const existing = await latestScribeSession(gate.actor.hospitalId, gate.appointment.id);
    if (existing && (existing.status === "RECORDING" || existing.status === "TRANSCRIBED")) {
      return NextResponse.json({ ok: true, resumed: true, session: scribeSessionView(existing) });
    }
    if (existing && existing.status === "DRAFTED") {
      return NextResponse.json(
        { error: "Discard the current draft before recording again." },
        { status: 409 },
      );
    }

    const session = await prisma.consultScribeSession.create({
      data: {
        hospitalId: gate.actor.hospitalId,
        appointmentId: gate.appointment.id,
        doctorUserId: gate.actor.id,
        consentAt: new Date(),
        status: "RECORDING",
        scribeModel: scribeModel(),
      },
    });
    return NextResponse.json({ ok: true, session: scribeSessionView(session) });
  }

  const session = sessionId
    ? await scribeSessionFor(gate.actor.hospitalId, gate.appointment.id, sessionId)
    : await latestScribeSession(gate.actor.hospitalId, gate.appointment.id);
  if (!session || session.status === "DISCARDED") {
    return NextResponse.json({ error: "No recording was found for this visit." }, { status: 404 });
  }

  if (action === "discard") {
    if (session.status === "APPLIED") {
      return NextResponse.json(
        { error: "This recording was already applied. Start a new one instead of discarding it." },
        { status: 409 },
      );
    }
    const updated = await prisma.consultScribeSession.update({
      where: { id: session.id },
      data: { status: "DISCARDED" },
    });
    return NextResponse.json({ ok: true, session: scribeSessionView(updated) });
  }

  if (action === "applied") {
    if (session.status !== "DRAFTED" && session.status !== "APPLIED") {
      return NextResponse.json({ error: "Draft the note before applying it." }, { status: 409 });
    }
    let draftJson = session.draftJson;
    if (body && "draft" in body && body.draft != null) {
      const parsed = parseScribeDraft(body.draft);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      draftJson = JSON.stringify(parsed.draft);
    }
    const updated = await prisma.consultScribeSession.update({
      where: { id: session.id },
      data: { status: "APPLIED", draftJson },
    });
    return NextResponse.json({ ok: true, session: scribeSessionView(updated) });
  }

  return NextResponse.json({ error: "Unknown scribe action." }, { status: 400 });
}
