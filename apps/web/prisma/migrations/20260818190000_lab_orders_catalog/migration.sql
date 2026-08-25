-- CreateEnum
CREATE TYPE "DiagnosticKind" AS ENUM ('BLOOD', 'SCAN');

-- CreateEnum
CREATE TYPE "DiagnosticOrderStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'SAMPLE_COLLECTED', 'RESULTED', 'CANCELLED');

-- AlterTable LabTest
ALTER TABLE "LabTest" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "LabTest" ADD COLUMN IF NOT EXISTS "kind" "DiagnosticKind" NOT NULL DEFAULT 'BLOOD';
ALTER TABLE "LabTest" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "LabTest" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LabTest" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable LabOrder
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "hospitalId" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "orderedByUserId" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "orderedByUsername" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "sampleCollectedAt" TIMESTAMP(3);
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "sampleCollectedBy" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "resultedAt" TIMESTAMP(3);
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "LabOrder" o
SET "hospitalId" = p."hospitalId"
FROM "Patient" p
WHERE o."patientId" = p."id" AND o."hospitalId" IS NULL;

DELETE FROM "LabOrder" WHERE "hospitalId" IS NULL;

ALTER TABLE "LabOrder" ALTER COLUMN "hospitalId" SET NOT NULL;

ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "statusEnum" "DiagnosticOrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT';

UPDATE "LabOrder"
SET "statusEnum" = CASE
  WHEN "status" IN ('PAID') THEN 'PAID'::"DiagnosticOrderStatus"
  WHEN "status" IN ('SAMPLE_COLLECTED', 'COLLECTED') THEN 'SAMPLE_COLLECTED'::"DiagnosticOrderStatus"
  WHEN "status" IN ('RESULTED', 'COMPLETED', 'DONE') THEN 'RESULTED'::"DiagnosticOrderStatus"
  WHEN "status" IN ('CANCELLED') THEN 'CANCELLED'::"DiagnosticOrderStatus"
  ELSE 'AWAITING_PAYMENT'::"DiagnosticOrderStatus"
END;

ALTER TABLE "LabOrder" DROP COLUMN IF EXISTS "status";
ALTER TABLE "LabOrder" RENAME COLUMN "statusEnum" TO "status";
ALTER TABLE "LabOrder" DROP COLUMN IF EXISTS "orderedAt";

-- AlterTable LabOrderItem
ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "nameSnapshot" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "categorySnapshot" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "resultUnit" TEXT;
ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "resultFlag" TEXT;
ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "resultedAt" TIMESTAMP(3);
ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "resultedByUsername" TEXT;

UPDATE "LabOrderItem" i
SET
  "nameSnapshot" = t."name",
  "categorySnapshot" = t."category",
  "unitPrice" = t."price"
FROM "LabTest" t
WHERE i."testId" = t."id" AND (i."nameSnapshot" = '' OR i."unitPrice" = 0);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HospitalLabPrice" (
    "hospitalId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isOffered" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalLabPrice_pkey" PRIMARY KEY ("hospitalId","testId")
);

CREATE INDEX IF NOT EXISTS "LabOrder_hospitalId_status_createdAt_idx" ON "LabOrder"("hospitalId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "LabOrder_appointmentId_idx" ON "LabOrder"("appointmentId");
CREATE INDEX IF NOT EXISTS "LabOrder_patientId_createdAt_idx" ON "LabOrder"("patientId", "createdAt");

ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HospitalLabPrice" ADD CONSTRAINT "HospitalLabPrice_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalLabPrice" ADD CONSTRAINT "HospitalLabPrice_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
