import { NextRequest, NextResponse } from "next/server";
import { catalogSyncNeedsSnapshot, getCatalogMeta } from "@/lib/drug-catalog-sync";
import { requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const sinceRaw = Number(request.nextUrl.searchParams.get("since") ?? "0");
  const since = Number.isFinite(sinceRaw) ? Math.trunc(sinceRaw) : NaN;
  if (!Number.isFinite(since) || since < 0) {
    return NextResponse.json({ error: "since must be a non-negative integer." }, { status: 400 });
  }

  const meta = await getCatalogMeta(prisma);
  if (since >= meta.version) {
    return NextResponse.json({ version: meta.version, reset: false, items: [] });
  }

  const changedCount = await prisma.drugCatalog.count({
    where: { syncVersion: { gt: since } },
  });
  if (catalogSyncNeedsSnapshot(changedCount)) {
    return NextResponse.json({ version: meta.version, reset: true, items: [] });
  }

  const rows = await prisma.drugCatalog.findMany({
    where: { syncVersion: { gt: since } },
    orderBy: [{ syncVersion: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      saltComposition: true,
      packSize: true,
      manufacturer: true,
      searchText: true,
      isDiscontinued: true,
    },
  });
  const manufacturerNames = [
    ...new Set(rows.map((row) => row.manufacturer).filter((name): name is string => Boolean(name))),
  ];
  const manufacturers =
    manufacturerNames.length > 0
      ? await prisma.drugManufacturer.findMany({
          where: { name: { in: manufacturerNames } },
          select: { name: true, medicineCount: true },
        })
      : [];
  const medicineCounts = new Map(manufacturers.map((row) => [row.name, row.medicineCount]));

  return NextResponse.json({
    version: meta.version,
    reset: false,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      salt: row.saltComposition,
      pack: row.packSize,
      manufacturer: row.manufacturer,
      searchText: row.searchText,
      medicineCount: row.manufacturer ? (medicineCounts.get(row.manufacturer) ?? 0) : 0,
      deleted: row.isDiscontinued,
    })),
  });
}
