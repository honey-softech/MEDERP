import type { Prisma, PrismaClient } from "@prisma/client";

type CatalogDb = PrismaClient | Prisma.TransactionClient;

/** Above this many changed rows, devices should download a fresh snapshot. */
export const CATALOG_DELTA_RESET_LIMIT = 5_000;

export function catalogSyncNeedsSnapshot(changedCount: number) {
  return changedCount > CATALOG_DELTA_RESET_LIMIT;
}

/** Unpublished import rows stay at 0 and must not ride along in a snapshot of an older cursor. */
export function catalogRowInSnapshot(syncVersion: number, capturedVersion: number) {
  return syncVersion > 0 && syncVersion <= capturedVersion;
}

/** Atomically increment the catalog cursor. Returns the new version. */
export async function bumpCatalogVersion(prisma: CatalogDb) {
  const rows = await prisma.$queryRaw<Array<{ version: number }>>`
    INSERT INTO "DrugCatalogMeta" ("id", "version", "updatedAt")
    VALUES (1, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE SET
      "version" = "DrugCatalogMeta"."version" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "version"
  `;
  return Number(rows[0]?.version ?? 1);
}

/** Assign the next catalog version to every row still waiting at syncVersion 0. */
export async function publishUnversionedCatalogRows(prisma: PrismaClient) {
  const pending = await prisma.drugCatalog.count({ where: { syncVersion: 0 } });
  if (pending === 0) return null;
  return prisma.$transaction(
    async (tx) => {
      const version = await bumpCatalogVersion(tx);
      await tx.drugCatalog.updateMany({
        where: { syncVersion: 0 },
        data: { syncVersion: version },
      });
      return version;
    },
    { timeout: 120_000 },
  );
}

export async function getCatalogMeta(prisma: PrismaClient) {
  const existing = await prisma.drugCatalogMeta.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.drugCatalogMeta.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, version: 0 },
  });
}
