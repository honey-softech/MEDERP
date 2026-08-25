CREATE TABLE IF NOT EXISTS "DrugManufacturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "medicineCount" INTEGER NOT NULL DEFAULT 0,
    "searchText" TEXT NOT NULL,

    CONSTRAINT "DrugManufacturer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DrugManufacturer_name_key" ON "DrugManufacturer"("name");
CREATE INDEX IF NOT EXISTS "DrugManufacturer_searchText_idx" ON "DrugManufacturer"("searchText");
CREATE INDEX IF NOT EXISTS "DrugManufacturer_medicineCount_idx" ON "DrugManufacturer"("medicineCount");
CREATE INDEX IF NOT EXISTS "DrugManufacturer_searchText_trgm_idx" ON "DrugManufacturer" USING gin ("searchText" gin_trgm_ops);

CREATE TABLE IF NOT EXISTS "HospitalDrugManufacturer" (
    "hospitalId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalDrugManufacturer_pkey" PRIMARY KEY ("hospitalId","manufacturerId")
);

CREATE INDEX IF NOT EXISTS "HospitalDrugManufacturer_manufacturerId_idx" ON "HospitalDrugManufacturer"("manufacturerId");

ALTER TABLE "HospitalDrugManufacturer"
  ADD CONSTRAINT "HospitalDrugManufacturer_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HospitalDrugManufacturer"
  ADD CONSTRAINT "HospitalDrugManufacturer_manufacturerId_fkey"
  FOREIGN KEY ("manufacturerId") REFERENCES "DrugManufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "DrugCatalog_manufacturer_idx" ON "DrugCatalog"("manufacturer");
