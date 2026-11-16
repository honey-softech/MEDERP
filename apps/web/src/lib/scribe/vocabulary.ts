import { prisma } from "@/lib/prisma";
import { parseMedications } from "@/lib/prescription-text";

const cache = new Map<string, { at: number; names: string[] }>();
const TTL_MS = 10 * 60_000;

/** Most-used medicine names from prescription lines, most frequent first. */
export function rankPrescribedNames(texts: string[], limit = 60) {
  const counts = new Map<string, { name: string; count: number }>();
  for (const text of texts) {
    for (const row of parseMedications(text)) {
      const name = row.name.trim();
      if (name.length < 3) continue;
      const key = name.toLowerCase();
      const current = counts.get(key);
      if (current) current.count += 1;
      else counts.set(key, { name, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((item) => item.name);
}

/** Guidance for the transcriber. The doctor's medicine names stay out of this text, because the model was reading that list aloud. */
export function transcribeVocabularyPrompt(names: string[] = []) {
  void names;
  return "Transcribe only the words spoken. Do not add symptoms, medicines, or doses.";
}

/** Names this doctor already prescribes, so the model picks a known tablet instead of inventing one. */
export async function doctorMedicineVocabulary(hospitalId: string, doctorId: string) {
  const key = `${hospitalId}:${doctorId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.names;
  try {
    const [visits, templates] = await Promise.all([
      prisma.visitAssessment.findMany({
        where: { hospitalId, prescription: { not: null }, appointment: { doctorId } },
        select: { prescription: true },
        orderBy: { updatedAt: "desc" },
        take: 150,
      }),
      prisma.rxTemplate.findMany({
        where: { hospitalId, doctorId },
        select: { prescription: true },
        take: 40,
      }),
    ]);
    const names = rankPrescribedNames([
      ...visits.map((visit) => visit.prescription ?? ""),
      ...templates.map((template) => template.prescription),
    ]);
    cache.set(key, { at: Date.now(), names });
    return names;
  } catch (error) {
    console.error("scribe vocabulary failed", error instanceof Error ? error.name : "error");
    return [];
  }
}
