-- Sync cursor for on-device DrugCatalog cache (snapshot + delta).
ALTER TABLE "DrugCatalog" ADD COLUMN "syncVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DrugCatalog" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DrugCatalog" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "DrugCatalog_updatedAt_idx" ON "DrugCatalog"("updatedAt");
CREATE INDEX "DrugCatalog_syncVersion_idx" ON "DrugCatalog"("syncVersion");

CREATE TABLE "DrugCatalogMeta" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugCatalogMeta_pkey" PRIMARY KEY ("id")
);

-- Existing rows become version 1 so devices can delta anything added after this migration.
UPDATE "DrugCatalog" SET "syncVersion" = 1 WHERE "syncVersion" = 0;
INSERT INTO "DrugCatalogMeta" ("id", "version", "updatedAt") VALUES (1, 1, CURRENT_TIMESTAMP);
