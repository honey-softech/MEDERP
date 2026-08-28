/**
 * Import Indian medicine CSV into DrugCatalog.
 *
 * Usage (local DB from .env):
 *   npm run db:import-drugs
 *
 * Usage (production DB — paste DATABASE_URL from Railway → Variables):
 *   $env:DATABASE_URL="postgresql://..."
 *   npm run db:import-drugs
 *
 * Optional CSV path or URL:
 *   npm run db:import-drugs -- https://example.com/medicines.csv
 */
import { PrismaClient } from "@prisma/client";
import { importDrugCatalog, resolveCatalogSource, syncDrugManufacturers } from "../src/lib/drug-catalog-import";

const prisma = new PrismaClient();

async function main() {
  const source = resolveCatalogSource(process.argv[2]);
  console.log(`Importing from:\n  ${source}`);
  const result = await importDrugCatalog(prisma, source);
  const manufacturers = await syncDrugManufacturers(prisma);
  console.log(
    `Catalog: ${result.catalogSize.toLocaleString()} medicines, ${manufacturers.toLocaleString()} manufacturers.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
