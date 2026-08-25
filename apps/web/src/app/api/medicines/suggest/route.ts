import { NextRequest, NextResponse } from "next/server";
import { preferredManufacturerNames } from "@/lib/drug-brands";
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

  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const prefix = `${q.replace(/[%_\\]/g, "\\$&")}%`;
  const brands = await preferredManufacturerNames(scoped.user.hospitalId);

  const brandFilter =
    brands.length > 0
      ? Prisma.sql`AND "manufacturer" IN (${Prisma.join(brands)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      saltComposition: string | null;
      packSize: string | null;
      manufacturer: string | null;
    }>
  >`
    SELECT "id", "name", "saltComposition", "packSize", "manufacturer"
    FROM "DrugCatalog"
    WHERE "isDiscontinued" = false
      AND "searchText" ILIKE ${pattern} ESCAPE '\\'
      ${brandFilter}
    ORDER BY
      CASE WHEN "name" ILIKE ${prefix} ESCAPE '\\' THEN 0 ELSE 1 END,
      similarity("searchText", ${q.toLowerCase()}) DESC,
      "name" ASC
    LIMIT ${limit}
  `;

  const items: DrugSuggestItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    salt: row.saltComposition,
    pack: row.packSize,
    manufacturer: row.manufacturer,
  }));

  return NextResponse.json({ items, brandFilterActive: brands.length > 0 });
}
