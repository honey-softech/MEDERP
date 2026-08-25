import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Syncing DrugManufacturer from DrugCatalog…");

  // Fast upsert via SQL — one pass, no N+1
  await prisma.$executeRaw`
    INSERT INTO "DrugManufacturer" ("id", "name", "medicineCount", "searchText")
    SELECT
      'm' || md5("manufacturer"),
      "manufacturer",
      COUNT(*)::int,
      lower(regexp_replace(trim("manufacturer"), '\\s+', ' ', 'g'))
    FROM "DrugCatalog"
    WHERE "manufacturer" IS NOT NULL AND TRIM("manufacturer") <> ''
    GROUP BY "manufacturer"
    ON CONFLICT ("name") DO UPDATE SET
      "medicineCount" = EXCLUDED."medicineCount",
      "searchText" = EXCLUDED."searchText"
  `;

  const count = await prisma.drugManufacturer.count();
  console.log(`Done. DrugManufacturer rows: ${count.toLocaleString()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
