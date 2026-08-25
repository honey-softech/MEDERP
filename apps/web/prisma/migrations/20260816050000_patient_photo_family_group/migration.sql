-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "photoData" TEXT;
ALTER TABLE "Patient" ADD COLUMN "familyGroupId" TEXT;
ALTER TABLE "Patient" ADD COLUMN "familyGroupCode" TEXT;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "photoData" TEXT;

-- CreateIndex
CREATE INDEX "Patient_hospitalId_familyGroupId_idx" ON "Patient"("hospitalId", "familyGroupId");
