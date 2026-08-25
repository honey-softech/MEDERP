ALTER TABLE "PlatformBillingSettings" ALTER COLUMN "extraUserFee" SET DEFAULT 1000;

UPDATE "PlatformBillingSettings"
SET "extraUserFee" = 1000
WHERE "extraUserFee" = 100;
