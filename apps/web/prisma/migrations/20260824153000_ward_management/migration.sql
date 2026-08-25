-- CreateEnum
CREATE TYPE "WardType" AS ENUM ('GENERAL', 'PRIVATE', 'SEMI_PRIVATE', 'ICU', 'ICCU', 'NICU', 'PICU', 'ISOLATION', 'LABOUR', 'DAY_CARE', 'CASUALTY');

-- CreateEnum
CREATE TYPE "WardGenderPolicy" AS ENUM ('MALE', 'FEMALE', 'MIXED', 'PAEDIATRIC');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'HOUSEKEEPING', 'MAINTENANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BedType" AS ENUM ('GENERAL', 'PRIVATE', 'SEMI_PRIVATE', 'ICU', 'VENTILATOR');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGE_ADVISED', 'DISCHARGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('ELECTIVE', 'EMERGENCY', 'DAY_CARE');

-- CreateEnum
CREATE TYPE "DischargeType" AS ENUM ('ROUTINE', 'LAMA', 'ABSCONDED', 'DEATH', 'TRANSFER_OUT');

-- AlterTable Ward
ALTER TABLE "Ward" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "Ward" ADD COLUMN "code" TEXT;
ALTER TABLE "Ward" ADD COLUMN "type" "WardType" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Ward" ADD COLUMN "genderPolicy" "WardGenderPolicy" NOT NULL DEFAULT 'MIXED';
ALTER TABLE "Ward" ADD COLUMN "floor" TEXT;
ALTER TABLE "Ward" ADD COLUMN "dailyRate" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Ward" ADD COLUMN "nursingRate" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Ward" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Ward" ADD COLUMN "notes" TEXT;
ALTER TABLE "Ward" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Ward" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Ward" w
SET "hospitalId" = d."hospitalId"
FROM "Department" d
WHERE w."departmentId" = d.id;

UPDATE "Ward"
SET "code" = UPPER(LEFT(REGEXP_REPLACE(COALESCE("name", 'WARD'), '[^A-Za-z0-9]', '', 'g'), 8))
  || SUBSTRING("id", LENGTH("id") - 3, 4)
WHERE "code" IS NULL OR "code" = '';

DELETE FROM "Ward" WHERE "hospitalId" IS NULL;

ALTER TABLE "Ward" ALTER COLUMN "hospitalId" SET NOT NULL;
ALTER TABLE "Ward" ALTER COLUMN "code" SET NOT NULL;

-- AlterTable Bed
ALTER TABLE "Bed" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "Bed" ADD COLUMN "room" TEXT;
ALTER TABLE "Bed" ADD COLUMN "type" "BedType" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Bed" ADD COLUMN "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "Bed" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Bed" ADD COLUMN "notes" TEXT;
ALTER TABLE "Bed" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Bed" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Bed" b
SET "hospitalId" = w."hospitalId"
FROM "Ward" w
WHERE b."wardId" = w.id;

UPDATE "Bed" SET "status" = 'OCCUPIED' WHERE "isOccupied" = true;

DELETE FROM "Bed" WHERE "hospitalId" IS NULL;

ALTER TABLE "Bed" ALTER COLUMN "hospitalId" SET NOT NULL;

-- AlterTable Admission
ALTER TABLE "Admission" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "Admission" ADD COLUMN "ipNumber" TEXT;
ALTER TABLE "Admission" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Admission" ADD COLUMN "admittingDoctorId" TEXT;
ALTER TABLE "Admission" ADD COLUMN "attendingDoctorId" TEXT;
ALTER TABLE "Admission" ADD COLUMN "sourceAppointmentId" TEXT;
ALTER TABLE "Admission" ADD COLUMN "type" "AdmissionType" NOT NULL DEFAULT 'ELECTIVE';
ALTER TABLE "Admission" ADD COLUMN "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED';
ALTER TABLE "Admission" ADD COLUMN "notes" TEXT;
ALTER TABLE "Admission" ADD COLUMN "attendantName" TEXT;
ALTER TABLE "Admission" ADD COLUMN "attendantPhone" TEXT;
ALTER TABLE "Admission" ADD COLUMN "expectedDischargeAt" TIMESTAMP(3);
ALTER TABLE "Admission" ADD COLUMN "dischargeType" "DischargeType";
ALTER TABLE "Admission" ADD COLUMN "dischargeNotes" TEXT;
ALTER TABLE "Admission" ADD COLUMN "dischargeAdviceAt" TIMESTAMP(3);
ALTER TABLE "Admission" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Admission" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Admission" a
SET "hospitalId" = p."hospitalId"
FROM "Patient" p
WHERE a."patientId" = p.id;

UPDATE "Admission"
SET "status" = 'DISCHARGED'
WHERE "dischargedAt" IS NOT NULL;

UPDATE "Admission"
SET "ipNumber" = 'IP-LEGACY-' || SUBSTRING("id", 1, 10)
WHERE "ipNumber" IS NULL OR "ipNumber" = '';

DELETE FROM "Admission" WHERE "hospitalId" IS NULL;

ALTER TABLE "Admission" ALTER COLUMN "hospitalId" SET NOT NULL;
ALTER TABLE "Admission" ALTER COLUMN "ipNumber" SET NOT NULL;

-- CreateTable
CREATE TABLE "BedTransfer" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "fromBedId" TEXT NOT NULL,
    "toBedId" TEXT NOT NULL,
    "reason" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferredByUserId" TEXT,

    CONSTRAINT "BedTransfer_pkey" PRIMARY KEY ("id")
);

-- AlterTable Invoice / Payment
ALTER TABLE "Invoice" ADD COLUMN "admissionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "admissionId" TEXT;

-- Foreign keys
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bed" ADD CONSTRAINT "Bed_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Admission" ADD CONSTRAINT "Admission_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_admittingDoctorId_fkey" FOREIGN KEY ("admittingDoctorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_attendingDoctorId_fkey" FOREIGN KEY ("attendingDoctorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_sourceAppointmentId_fkey" FOREIGN KEY ("sourceAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BedTransfer" ADD CONSTRAINT "BedTransfer_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BedTransfer" ADD CONSTRAINT "BedTransfer_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BedTransfer" ADD CONSTRAINT "BedTransfer_fromBedId_fkey" FOREIGN KEY ("fromBedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BedTransfer" ADD CONSTRAINT "BedTransfer_toBedId_fkey" FOREIGN KEY ("toBedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes / uniques
CREATE UNIQUE INDEX "Ward_hospitalId_code_key" ON "Ward"("hospitalId", "code");
CREATE INDEX "Ward_hospitalId_isActive_idx" ON "Ward"("hospitalId", "isActive");

CREATE INDEX "Bed_hospitalId_status_idx" ON "Bed"("hospitalId", "status");

CREATE UNIQUE INDEX "Admission_hospitalId_ipNumber_key" ON "Admission"("hospitalId", "ipNumber");
CREATE INDEX "Admission_hospitalId_status_idx" ON "Admission"("hospitalId", "status");
CREATE INDEX "Admission_patientId_status_idx" ON "Admission"("patientId", "status");
CREATE INDEX "Admission_bedId_status_idx" ON "Admission"("bedId", "status");

CREATE UNIQUE INDEX "Admission_one_active_per_patient" ON "Admission"("patientId") WHERE "status" IN ('ADMITTED', 'DISCHARGE_ADVISED');
CREATE UNIQUE INDEX "Admission_one_active_per_bed" ON "Admission"("bedId") WHERE "status" IN ('ADMITTED', 'DISCHARGE_ADVISED');

CREATE INDEX "BedTransfer_admissionId_transferredAt_idx" ON "BedTransfer"("admissionId", "transferredAt");
CREATE INDEX "BedTransfer_hospitalId_transferredAt_idx" ON "BedTransfer"("hospitalId", "transferredAt");
