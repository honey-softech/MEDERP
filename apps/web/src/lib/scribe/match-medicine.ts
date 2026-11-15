import { Prisma } from "@prisma/client";
import { catalogNameForSpoken } from "@/lib/scribe/draft-schema";
import { prisma } from "@/lib/prisma";

/** Same DrugCatalog the medicine search uses. A miss stays free text. */
export async function matchSpokenMedicine(spoken: string) {
  const label = spoken.trim();
  if (label.length < 2) return { name: label, matched: false };
  const safe = label.replace(/[%_\\]/g, "").trim();
  if (safe.length < 2) return { name: label, matched: false };

  try {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>(Prisma.sql`
      SELECT name
      FROM "DrugCatalog"
      WHERE "isDiscontinued" = false
        AND (name ILIKE ${`${safe}%`} OR "searchText" ILIKE ${`%${safe}%`})
      ORDER BY CASE WHEN name ILIKE ${`${safe}%`} THEN 0 ELSE 1 END, name ASC
      LIMIT 8
    `);
    return catalogNameForSpoken(label, rows.map((row) => row.name));
  } catch (error) {
    console.error("scribe medicine match failed", error instanceof Error ? error.name : "error");
    return { name: label, matched: false };
  }
}
