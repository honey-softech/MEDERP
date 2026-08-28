/**
 * No-op if DrugCatalog already has rows. Otherwise downloads the public
 * Indian medicine CSV and loads it. Safe to run on every production start.
 */
import { PrismaClient } from "@prisma/client";
import { ensureDrugCatalog } from "../src/lib/drug-catalog-import";

const prisma = new PrismaClient();

async function main() {
  try {
    await ensureDrugCatalog(prisma);
  } catch (error) {
    console.error("Drug catalog ensure failed (app will still start):", error);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
