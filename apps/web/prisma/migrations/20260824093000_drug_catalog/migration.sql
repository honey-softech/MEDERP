-- Enable trigram search for medicine autosuggest
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "DrugCatalog" (
    "id" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "packSize" TEXT,
    "saltComposition" TEXT,
    "type" TEXT,
    "searchText" TEXT NOT NULL,
    "isDiscontinued" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DrugCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DrugCatalog_sourceId_key" ON "DrugCatalog"("sourceId");
CREATE INDEX IF NOT EXISTS "DrugCatalog_name_idx" ON "DrugCatalog"("name");
CREATE INDEX IF NOT EXISTS "DrugCatalog_searchText_idx" ON "DrugCatalog"("searchText");
CREATE INDEX IF NOT EXISTS "DrugCatalog_searchText_trgm_idx" ON "DrugCatalog" USING gin ("searchText" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "DrugCatalog_name_trgm_idx" ON "DrugCatalog" USING gin ("name" gin_trgm_ops);
