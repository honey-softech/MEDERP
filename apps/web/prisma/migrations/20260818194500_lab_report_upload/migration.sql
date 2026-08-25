-- AlterTable LabOrder: uploaded result document
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "reportFileName" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "reportMimeType" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "reportSize" INTEGER;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "reportUploadedAt" TIMESTAMP(3);
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "reportUploadedByUsername" TEXT;
