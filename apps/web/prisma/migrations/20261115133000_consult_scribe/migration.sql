-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN "aiScribeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VisitAssessment" ADD COLUMN "aiAssisted" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "ConsultScribeStatus" AS ENUM ('RECORDING', 'TRANSCRIBED', 'DRAFTED', 'APPLIED', 'DISCARDED');

-- CreateTable
CREATE TABLE "ConsultScribeSession" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "doctorUserId" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "ConsultScribeStatus" NOT NULL DEFAULT 'RECORDING',
    "transcript" TEXT,
    "draftJson" TEXT,
    "transcribeModel" TEXT,
    "scribeModel" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultScribeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultScribeSession_hospitalId_appointmentId_status_idx" ON "ConsultScribeSession"("hospitalId", "appointmentId", "status");

-- CreateIndex
CREATE INDEX "ConsultScribeSession_appointmentId_createdAt_idx" ON "ConsultScribeSession"("appointmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsultScribeSession" ADD CONSTRAINT "ConsultScribeSession_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultScribeSession" ADD CONSTRAINT "ConsultScribeSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultScribeSession" ADD CONSTRAINT "ConsultScribeSession_doctorUserId_fkey" FOREIGN KEY ("doctorUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
