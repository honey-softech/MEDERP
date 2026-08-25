import { prisma } from "@/lib/prisma";

export async function preferredManufacturerNames(hospitalId: string) {
  const rows = await prisma.hospitalDrugManufacturer.findMany({
    where: { hospitalId },
    select: { manufacturer: { select: { name: true } } },
  });
  return rows.map((row) => row.manufacturer.name);
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
