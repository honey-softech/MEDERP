import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { addMedicineToCatalog } from "@/lib/drug-catalog-import";
import { prisma } from "@/lib/prisma";

function canManageCatalog(role: string) {
  return role === "SOFTWARE_ADMIN" || role === "HELPDESK";
}

export type CatalogMedicineItem = {
  id: string;
  name: string;
  manufacturer: string | null;
  saltComposition: string | null;
  packSize: string | null;
  type: string | null;
  sameManufacturer: boolean;
};

/** Find similar catalog medicines (for duplicate-check while adding). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || !canManageCatalog(user.role)) {
    return NextResponse.json({ error: "Software admin or helpdesk access required." }, { status: 403 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const manufacturer = (request.nextUrl.searchParams.get("manufacturer") ?? "").trim();
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 20) : 12;

  if (q.length < 2) {
    return NextResponse.json({ items: [] as CatalogMedicineItem[] });
  }

  const safe = q.replace(/[%_\\]/g, "");
  const pattern = `%${safe}%`;
  const prefix = `${safe}%`;
  const mfrSafe = manufacturer.replace(/[%_\\]/g, "");
  const mfrPattern = mfrSafe ? `%${mfrSafe}%` : null;

  const manufacturerFilter = mfrPattern
    ? Prisma.sql`AND "manufacturer" ILIKE ${mfrPattern}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      manufacturer: string | null;
      saltComposition: string | null;
      packSize: string | null;
      type: string | null;
    }>
  >`
    SELECT "id", "name", "manufacturer", "saltComposition", "packSize", "type"
    FROM "DrugCatalog"
    WHERE "isDiscontinued" = false
      AND ("name" ILIKE ${pattern} OR "searchText" ILIKE ${pattern})
      ${manufacturerFilter}
    ORDER BY
      CASE WHEN "name" ILIKE ${prefix} THEN 0 ELSE 1 END,
      "name" ASC
    LIMIT ${limit}
  `;

  // If a manufacturer was typed but few/no same-brand hits, also surface similar names from other makers.
  let extra: typeof rows = [];
  if (mfrPattern && rows.length < limit) {
    const excludeIds = rows.map((r) => r.id);
    const excludeFilter =
      excludeIds.length > 0
        ? Prisma.sql`AND "id" NOT IN (${Prisma.join(excludeIds)})`
        : Prisma.empty;
    extra = await prisma.$queryRaw<typeof rows>`
      SELECT "id", "name", "manufacturer", "saltComposition", "packSize", "type"
      FROM "DrugCatalog"
      WHERE "isDiscontinued" = false
        AND ("name" ILIKE ${pattern} OR "searchText" ILIKE ${pattern})
        ${excludeFilter}
      ORDER BY
        CASE WHEN "name" ILIKE ${prefix} THEN 0 ELSE 1 END,
        "name" ASC
      LIMIT ${limit - rows.length}
    `;
  }

  const mfrLower = manufacturer.toLowerCase();
  const items: CatalogMedicineItem[] = [...rows, ...extra].map((row) => ({
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer,
    saltComposition: row.saltComposition,
    packSize: row.packSize,
    type: row.type,
    sameManufacturer: Boolean(
      mfrLower && row.manufacturer && row.manufacturer.toLowerCase().includes(mfrLower),
    ),
  }));

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || !canManageCatalog(user.role)) {
    return NextResponse.json({ error: "Software admin or helpdesk access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const medicine = await addMedicineToCatalog(prisma, {
      name: String(body.name ?? ""),
      manufacturer: body.manufacturer != null ? String(body.manufacturer) : null,
      packSize: body.packSize != null ? String(body.packSize) : null,
      saltComposition: body.saltComposition != null ? String(body.saltComposition) : null,
      type: body.type != null ? String(body.type) : null,
    });

    await writeAuditLog({
      request,
      hospitalId: null,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "DRUG_CATALOG_MEDICINE_ADDED",
      entity: "DrugCatalog",
      entityId: medicine.id,
      summary: `${user.username} added medicine ${medicine.name} to the server catalog.`,
      metadata: {
        sourceId: medicine.sourceId,
        manufacturer: medicine.manufacturer,
        saltComposition: medicine.saltComposition,
      },
    });

    return NextResponse.json({ ok: true, medicine });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not add medicine." },
      { status: 400 },
    );
  }
}
