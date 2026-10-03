import { prisma } from "@/lib/prisma";

export async function preferredManufacturerNames(hospitalId: string) {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT m."name"
    FROM "HospitalDrugManufacturer" h
    JOIN "DrugManufacturer" m ON m."id" = h."manufacturerId"
    WHERE h."hospitalId" = ${hospitalId}
    ORDER BY h."priority" ASC, m."name" ASC
  `;
  return rows.map((row) => row.name);
}

export async function listManufacturersForPicker(query: string, limit = 40) {
  const q = query.trim().toLowerCase();
  if (q.length >= 2) {
    const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    return prisma.$queryRaw<
      Array<{ id: string; name: string; medicineCount: number }>
    >`
      SELECT "id", "name", "medicineCount"
      FROM "DrugManufacturer"
      WHERE "searchText" ILIKE ${pattern} ESCAPE '\\'
      ORDER BY
        CASE WHEN "searchText" LIKE ${q + "%"} THEN 0 ELSE 1 END,
        "medicineCount" DESC,
        "name" ASC
      LIMIT ${limit}
    `;
  }

  return prisma.drugManufacturer.findMany({
    orderBy: [{ medicineCount: "desc" }, { name: "asc" }],
    take: limit,
    select: { id: true, name: true, medicineCount: true },
  });
}

/** Append one manufacturer to the hospital preferred list (idempotent). */
export async function addPreferredManufacturer(
  hospitalId: string,
  input: { manufacturerId?: string; manufacturerName?: string },
) {
  const manufacturer = input.manufacturerId
    ? await prisma.drugManufacturer.findUnique({ where: { id: input.manufacturerId } })
    : input.manufacturerName?.trim()
      ? await prisma.drugManufacturer.findFirst({
          where: { name: { equals: input.manufacturerName.trim(), mode: "insensitive" } },
        })
      : null;

  if (!manufacturer) return { error: "Manufacturer not found." as const, manufacturer: null };

  const existing = await prisma.hospitalDrugManufacturer.findUnique({
    where: {
      hospitalId_manufacturerId: { hospitalId, manufacturerId: manufacturer.id },
    },
  });
  if (existing) {
    return { error: null, manufacturer, alreadyPreferred: true as const };
  }

  const [{ maxPriority }] = await prisma.$queryRaw<Array<{ maxPriority: number | null }>>`
    SELECT MAX("priority")::int AS "maxPriority"
    FROM "HospitalDrugManufacturer"
    WHERE "hospitalId" = ${hospitalId}
  `;
  const priority = (maxPriority ?? -1) + 1;

  await prisma.$executeRaw`
    INSERT INTO "HospitalDrugManufacturer" ("hospitalId", "manufacturerId", "priority", "createdAt")
    VALUES (${hospitalId}, ${manufacturer.id}, ${priority}, CURRENT_TIMESTAMP)
    ON CONFLICT ("hospitalId", "manufacturerId") DO NOTHING
  `;

  return { error: null, manufacturer, alreadyPreferred: false as const };
}

export async function replacePreferredManufacturers(hospitalId: string, manufacturerIds: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.hospitalDrugManufacturer.deleteMany({ where: { hospitalId } });
    for (let index = 0; index < manufacturerIds.length; index += 1) {
      const manufacturerId = manufacturerIds[index]!;
      await tx.$executeRaw`
        INSERT INTO "HospitalDrugManufacturer" ("hospitalId", "manufacturerId", "priority", "createdAt")
        VALUES (${hospitalId}, ${manufacturerId}, ${index}, CURRENT_TIMESTAMP)
      `;
    }
  });
}

export async function listPreferredManufacturers(hospitalId: string) {
  return prisma.$queryRaw<
    Array<{ id: string; name: string; medicineCount: number; priority: number }>
  >`
    SELECT m."id", m."name", m."medicineCount", h."priority"
    FROM "HospitalDrugManufacturer" h
    JOIN "DrugManufacturer" m ON m."id" = h."manufacturerId"
    WHERE h."hospitalId" = ${hospitalId}
    ORDER BY h."priority" ASC, m."name" ASC
  `;
}
