-- Fixed subscription tiers: store plan id + inventory + unlimited seats

ALTER TABLE "Hospital" ADD COLUMN IF NOT EXISTS "subscriptionTier" TEXT NOT NULL DEFAULT 'STARTER';
ALTER TABLE "Hospital" ADD COLUMN IF NOT EXISTS "unlimitedStaffSeats" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Hospital" ADD COLUMN IF NOT EXISTS "inventoryEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "HospitalSubscription" ADD COLUMN IF NOT EXISTS "pendingSubscriptionTier" TEXT;
ALTER TABLE "HospitalSubscription" ADD COLUMN IF NOT EXISTS "pendingInventoryEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: pharmacies that already had pharmacy get inventory for continuity
UPDATE "Hospital" SET "inventoryEnabled" = true WHERE "pharmacyEnabled" = true;

-- Map approximate legacy packages onto closest tier by seat + modules
UPDATE "Hospital"
SET
  "subscriptionTier" = 'ENTERPRISE',
  "unlimitedStaffSeats" = true
WHERE ("includedStaffSlots" + "extraStaffSlots") >= 50;

UPDATE "Hospital"
SET "subscriptionTier" = 'PROFESSIONAL'
WHERE "subscriptionTier" = 'STARTER'
  AND "pharmacyEnabled" = true
  AND "labEnabled" = true
  AND ("includedStaffSlots" + "extraStaffSlots") >= 15;

UPDATE "Hospital"
SET "subscriptionTier" = 'GROWTH'
WHERE "subscriptionTier" = 'STARTER'
  AND ("pharmacyEnabled" = true OR "labEnabled" = true);
