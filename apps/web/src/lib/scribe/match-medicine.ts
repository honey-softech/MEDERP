import { Prisma } from "@prisma/client";
import { medicineSearchTokens, rankMedicineCandidates } from "@/lib/scribe/medicine-match";
import { prisma } from "@/lib/prisma";

/** Catalog plus the doctor's own names. A weak match stays free text with a few choices. */
export async function matchSpokenMedicine(
  spoken: string,
  options?: { catalogChoice?: string; vocabulary?: string[] },
) {
  const label = spoken.trim();
  const vocabulary = options?.vocabulary ?? [];
  if (label.length < 2 && !(options?.catalogChoice ?? "").trim()) {
    return { name: label, matched: false, confidence: "none" as const, alternatives: [] as string[] };
  }

  const tokens = medicineSearchTokens(label);
  let catalogNames: string[] = [];
  if (tokens.length > 0) {
    try {
      const filters = tokens.map((token) => {
        const safe = token.replace(/[%_\\]/g, "");
        return Prisma.sql`(name ILIKE ${`${safe}%`} OR "searchText" ILIKE ${`%${safe}%`})`;
      });
      const where = filters.slice(1).reduce((query, filter) => Prisma.sql`${query} OR ${filter}`, filters[0] ?? Prisma.sql`FALSE`);
      const rows = await prisma.$queryRaw<Array<{ name: string }>>(Prisma.sql`
        SELECT name
        FROM "DrugCatalog"
        WHERE "isDiscontinued" = false
          AND (${where})
        ORDER BY name ASC
        LIMIT 24
      `);
      catalogNames = rows.map((row) => row.name);
    } catch (error) {
      console.error("scribe medicine match failed", error instanceof Error ? error.name : "error");
    }
  }

  return rankMedicineCandidates({
    spoken: label,
    catalogChoice: options?.catalogChoice,
    candidates: [...vocabulary, ...catalogNames],
  });
}
