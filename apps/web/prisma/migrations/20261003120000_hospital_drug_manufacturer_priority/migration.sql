-- Preferred manufacturer sort order for prescription suggest.
ALTER TABLE "HospitalDrugManufacturer" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "HospitalDrugManufacturer_hospitalId_priority_idx"
  ON "HospitalDrugManufacturer"("hospitalId", "priority");
