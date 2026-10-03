import { NextRequest, NextResponse } from "next/server";
import { preferredManufacturerNames } from "@/lib/drug-brands";
import {
  drugMatchesForm,
  drugMatchesStrength,
  normalizeForm,
  parseDrugQuery,
  sectionDrugSuggestions,
} from "@/lib/drug-catalog-cache/search";
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

function stripMedicineCount<T extends DrugSuggestItem & { medicineCount?: number }>(row: T): DrugSuggestItem {
  return {
    id: row.id,
    name: row.name,
    salt: row.salt,
    pack: row.pack,
    manufacturer: row.manufacturer,
  };
}

export async function GET(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 20) : 12;
  const manufacturerParam = (request.nextUrl.searchParams.get("manufacturer") ?? "boost").trim().toLowerCase();
  const formParam = normalizeForm(request.nextUrl.searchParams.get("form"));
  const strengthParam = (request.nextUrl.searchParams.get("strength") ?? "").trim().toLowerCase().replace(/\s+/g, "") || null;

  if (q.length < 2) {
    return NextResponse.json({
      items: [] as DrugSuggestItem[],
      preferred: [] as DrugSuggestItem[],
      other: [] as DrugSuggestItem[],
      preferredManufacturers: [] as string[],
      brandFilterActive: false,
      canManagePreferred: scoped.user.role === "SUPER_ADMIN" || scoped.user.role === "DOCTOR",
    });
  }

  try {
  const parsed = parseDrugQuery(q);
  const searchText = parsed.text.length >= 2 ? parsed.text : q;
  const form = formParam ?? parsed.form;
  const strength = strengthParam ?? parsed.strength;

  const safe = searchText.replace(/[%_\\]/g, "");
  const pattern = `%${safe}%`;
  const prefix = `${safe}%`;
  const brands = await preferredManufacturerNames(scoped.user.hospitalId);
  const candidates = Math.max(limit * 3, 36);
  const preferredSet = new Set(brands.map((name) => name.toLowerCase()));

  const manufacturerMode =
    manufacturerParam === "preferred" || manufacturerParam === "all" || manufacturerParam === "boost"
      ? manufacturerParam
      : "named";
  const namedManufacturer =
    manufacturerMode === "named" ? (request.nextUrl.searchParams.get("manufacturer") ?? "").trim() : "";

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

  let preferredRows: Awaited<ReturnType<typeof loadMatches>> = [];
  let otherRows: Awaited<ReturnType<typeof loadMatches>> = [];

  if (manufacturerMode === "preferred") {
    if (brands.length === 0) {
      preferredRows = [];
      otherRows = [];
    } else {
      preferredRows = await loadMatches(Prisma.sql`AND d."manufacturer" IN (${Prisma.join(brands)})`);
    }
  } else if (manufacturerMode === "named" && namedManufacturer) {
    otherRows = await loadMatches(Prisma.sql`AND d."manufacturer" ILIKE ${namedManufacturer}`);
  } else if (manufacturerMode === "all" || brands.length === 0) {
    otherRows = await loadMatches(Prisma.empty);
  } else {
    const preferredSql = Prisma.sql`AND d."manufacturer" IN (${Prisma.join(brands)})`;
    const otherSql = Prisma.sql`AND (d."manufacturer" IS NULL OR d."manufacturer" NOT IN (${Prisma.join(brands)}))`;
    [preferredRows, otherRows] = await Promise.all([loadMatches(preferredSql), loadMatches(otherSql)]);
  }

  const filterExtras = <T extends { name: string; salt: string | null; pack: string | null; manufacturer: string | null }>(
    rows: T[],
  ) =>
    rows.filter((row) => drugMatchesForm(row, form) && drugMatchesStrength(row, strength));

  preferredRows = filterExtras(preferredRows);
  otherRows = filterExtras(otherRows);

  // When user asked for preferred-only, keep everything in preferred bucket.
  const mergedForRank =
    manufacturerMode === "preferred"
      ? preferredRows
      : manufacturerMode === "named" || manufacturerMode === "all"
        ? otherRows
        : [...preferredRows, ...otherRows];

  const sectioned = sectionDrugSuggestions(
    mergedForRank,
    q,
    manufacturerMode === "boost" ? brands : manufacturerMode === "preferred" ? brands : [],
    limit,
  );

  // For named/all modes, sectionDrugSuggestions puts everything in `other` when preferred list is empty for ranking.
  // Re-label named/all results into a single flat list under `other`, and for preferred-only under `preferred`.
  let preferredOut = sectioned.preferred.map(stripMedicineCount);
  let otherOut = sectioned.other.map(stripMedicineCount);
  if (manufacturerMode === "preferred") {
    preferredOut = sectioned.items.map(stripMedicineCount);
    otherOut = [];
  } else if (manufacturerMode === "named" || manufacturerMode === "all") {
    preferredOut = [];
    otherOut = sectioned.items.map(stripMedicineCount);
  } else {
    // boost: keep sectioned preferred/other; if ranking preferred set empty, promote preferred manufacturers from items
    if (preferredOut.length === 0 && preferredSet.size > 0) {
      preferredOut = sectioned.items
        .filter((item) => item.manufacturer && preferredSet.has(item.manufacturer.toLowerCase()))
        .map(stripMedicineCount);
      otherOut = sectioned.items
        .filter((item) => !item.manufacturer || !preferredSet.has(item.manufacturer.toLowerCase()))
        .map(stripMedicineCount);
    }
  }

  const items = [...preferredOut, ...otherOut];

  return NextResponse.json({
    items,
    preferred: preferredOut,
    other: otherOut,
    preferredManufacturers: brands,
    brandFilterActive: brands.length > 0,
    manufacturerMode,
    form,
    strength,
    canManagePreferred: scoped.user.role === "SUPER_ADMIN" || scoped.user.role === "DOCTOR",
  });
  } catch (error) {
    console.error("[medicines/suggest]", error);
    return NextResponse.json({ error: "Medicine search failed." }, { status: 500 });
  }
}
