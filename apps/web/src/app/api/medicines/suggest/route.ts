import { NextRequest, NextResponse } from "next/server";
import { preferredManufacturerNames } from "@/lib/drug-brands";
import { rankDrugSuggestions } from "@/lib/drug-catalog-cache/search";
import { requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type DrugSuggestItem = {
  id: string;
  name: string;
  salt: string | null;
  pack: string | null;
  manufacturer: string | null;
};

export async function GET(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 20) : 12;

  if (q.length < 2) {
    return NextResponse.json({ items: [] as DrugSuggestItem[] });
  }

  const safe = q.replace(/[%_\\]/g, "");
  const pattern = `%${safe}%`;
  const prefix = `${safe}%`;
  const brands = await preferredManufacturerNames(scoped.user.hospitalId);
  const candidates = Math.max(limit, 24);

  async function loadMatches(manufacturerSql: Prisma.Sql) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        saltComposition: string | null;
        packSize: string | null;
        manufacturer: string | null;
        medicineCount: number;
      }>
    >`
      SELECT d."id", d."name", d."saltComposition", d."packSize", d."manufacturer",
             COALESCE(m."medicineCount", 0)::int AS "medicineCount"
      FROM "DrugCatalog" d
      LEFT JOIN "DrugManufacturer" m ON m."name" = d."manufacturer"
      WHERE d."isDiscontinued" = false
        AND (d."searchText" ILIKE ${pattern} OR d."name" ILIKE ${pattern})
        ${manufacturerSql}
      ORDER BY
        COALESCE(m."medicineCount", 0) DESC,
        CASE WHEN d."name" ILIKE ${prefix} THEN 0 ELSE 1 END,
        d."name" ASC
      LIMIT ${candidates}
    `;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      salt: row.saltComposition,
      pack: row.packSize,
      manufacturer: row.manufacturer,
      medicineCount: Number(row.medicineCount ?? 0),
    }));
  }

  const preferredSql =
    brands.length > 0 ? Prisma.sql`AND d."manufacturer" IN (${Prisma.join(brands)})` : Prisma.sql`AND false`;
  const otherSql =
    brands.length > 0
      ? Prisma.sql`AND (d."manufacturer" IS NULL OR d."manufacturer" NOT IN (${Prisma.join(brands)}))`
      : Prisma.empty;

  const [preferredRows, otherRows] = await Promise.all([
    brands.length > 0 ? loadMatches(preferredSql) : Promise.resolve([]),
    loadMatches(otherSql),
  ]);

  const items: DrugSuggestItem[] = rankDrugSuggestions(
    [...preferredRows, ...otherRows],
    q,
    brands,
    limit,
  ).map(({ medicineCount: _medicineCount, ...item }) => item);

  return NextResponse.json({ items, brandFilterActive: brands.length > 0 });
}
