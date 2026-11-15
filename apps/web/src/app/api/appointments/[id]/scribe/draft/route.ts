import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireScribeAppointment, scribeSessionFor, scribeSessionView } from "@/lib/scribe/access";
import { parseScribeDraft, type ScribeMedicine } from "@/lib/scribe/draft-schema";
import { matchSpokenMedicine } from "@/lib/scribe/match-medicine";
import { draftConsult, ScribeProviderError, scribeConfigured, scribeModel, scribeNotConfiguredMessage } from "@/lib/scribe/openai";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  const gate = await requireScribeAppointment(id);
  if (!gate.ok) return gate.response;

  const limited = checkRateLimit(`scribe-draft:${gate.actor.id}`, { limit: 8, windowMs: 10 * 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many scribe requests. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  if (!scribeConfigured()) {
    return NextResponse.json({ error: scribeNotConfiguredMessage() }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  const session = await scribeSessionFor(gate.actor.hospitalId, gate.appointment.id, String(body?.sessionId ?? ""));
  if (!session || session.status === "DISCARDED") {
    return NextResponse.json({ error: "No recording was found for this visit." }, { status: 404 });
  }
  if (!session.transcript?.trim()) {
    return NextResponse.json({ error: "Record the consultation before drafting." }, { status: 400 });
  }

  try {
    const english = session.translation?.trim() ?? "";
    const original = session.transcript.trim();
    const combined =
      english && english !== original
        ? `English wording:\n${english}\n\nOriginal words:\n${original}`
        : original;
    const raw = await draftConsult(combined);
    const parsed = parseScribeDraft(raw);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 502 });
    }

    const medicines: ScribeMedicine[] = [];
    for (const medicine of parsed.draft.medicines) {
      const spoken = medicine.spokenName || medicine.name;
      const match = await matchSpokenMedicine(spoken);
      medicines.push({
        ...medicine,
        spokenName: spoken,
        name: match.matched ? match.name : spoken,
        matched: match.matched,
      });
    }
    const draft = { ...parsed.draft, medicines };
    const updated = await prisma.consultScribeSession.update({
      where: { id: session.id },
      data: {
        draftJson: JSON.stringify(draft),
        scribeModel: scribeModel(),
        status: session.status === "APPLIED" ? "APPLIED" : "DRAFTED",
      },
    });
    return NextResponse.json({ ok: true, session: scribeSessionView(updated) });
  } catch (error) {
    if (error instanceof ScribeProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("scribe draft failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Could not draft the visit note." }, { status: 502 });
  }
}
