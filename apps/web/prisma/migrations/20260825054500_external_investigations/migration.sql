-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "DiagnosticOrderStatus" ADD VALUE 'AWAITING_EXTERNAL_REPORT';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DiagnosticFulfillment" AS ENUM ('HOSPITAL_LAB', 'EXTERNAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "fulfillment" "DiagnosticFulfillment" NOT NULL DEFAULT 'HOSPITAL_LAB';
