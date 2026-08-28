import { PrismaClient } from "@prisma/client";
import { syncDrugManufacturers } from "../src/lib/drug-catalog-import";

const prisma = new PrismaClient();

async function main() {
  console.log("Syncing DrugManufacturer from DrugCatalog…");
  const count = await syncDrugManufacturers(prisma);
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
