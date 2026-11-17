import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireScribeAppointment, scribeSessionFor, scribeSessionView } from "@/lib/scribe/access";
import { assembleDraft, parseScribeDraft, type ScribeMedicine } from "@/lib/scribe/draft-schema";
import { quoteMentionsSpoken, stripUnsupportedNumbers, verifyEvidence } from "@/lib/scribe/evidence";
import { matchSpokenMedicine } from "@/lib/scribe/match-medicine";
import { medicinePhrases } from "@/lib/scribe/medicine-match";
import { doctorMedicineVocabulary } from "@/lib/scribe/vocabulary";
import {
  draftConsult,
  ScribeProviderError,
  scribeConfigured,
  scribeModel,
  scribeNotConfiguredMessage,
  scribePreviewModel,
} from "@/lib/scribe/openai";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  const gate = await requireScribeAppointment(id);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as { sessionId?: unknown; preview?: unknown } | null;
  const preview = body?.preview === true;
  const limited = checkRateLimit(preview ? `scribe-preview:${gate.actor.id}` : `scribe-draft:${gate.actor.id}`, {
    limit: preview ? 12 : 8,
    windowMs: 10 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many scribe requests. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  if (!scribeConfigured()) {
    return NextResponse.json({ error: scribeNotConfiguredMessage() }, { status: 503 });
  }
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
    const vocabulary = await doctorMedicineVocabulary(gate.actor.hospitalId, gate.appointment.doctorId);
    const model = preview ? scribePreviewModel() : scribeModel();
    const raw = await draftConsult(combined, vocabulary, model);
    const parsed = parseScribeDraft(raw);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 502 });
    }

    const verified = verifyEvidence(parsed.draft, combined);
    const medicines: ScribeMedicine[] = [];
    const suggestions = new Set<string>();
    const offer = (names: string[]) => {
      for (const name of names) {
        const label = name.trim();
        if (label) suggestions.add(label);
      }
    };
    for (const medicine of verified.medicines) {
      const spoken = medicine.spokenName || medicine.name;
      if (!quoteMentionsSpoken(medicine.quote, spoken)) continue;
      const match = await matchSpokenMedicine(spoken, {
        catalogChoice: medicine.catalogChoice,
        vocabulary,
      });
      if (match.confidence === "high") {
        const named = stripUnsupportedNumbers(match.name, medicine.quote).trim() || spoken;
        medicines.push({
          ...medicine,
          spokenName: spoken,
          name: named,
          matched: true,
          uncertain: medicine.uncertain,
          alternatives: [],
          catalogChoice: undefined,
        });
        continue;
      }
      offer(match.alternatives);
      for (const phrase of medicinePhrases(medicine.quote)) {
        const loose = await matchSpokenMedicine(phrase, { vocabulary });
        if (loose.confidence === "high") offer([loose.name]);
        offer(loose.alternatives);
      }
    }
    const draft = assembleDraft({
      evidence: verified.evidence,
      medicines,
      followUpInDays: verified.followUpInDays,
      outcome: verified.outcome,
      uncertainFields: verified.uncertainFields,
      missingFields: verified.missingFields,
    });
    const updated = await prisma.consultScribeSession.update({
      where: { id: session.id },
      data: {
        draftJson: JSON.stringify(draft),
        scribeModel: model,
        status: preview || session.status === "APPLIED" ? session.status : "DRAFTED",
      },
    });
    return NextResponse.json({
      ok: true,
      suggestions: [...suggestions].slice(0, 6),
      session: scribeSessionView(updated),
    });
  } catch (error) {
    if (error instanceof ScribeProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("scribe draft failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Could not draft the visit note." }, { status: 502 });
  }
}
