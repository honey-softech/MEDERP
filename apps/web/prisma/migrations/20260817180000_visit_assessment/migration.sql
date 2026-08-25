-- CreateEnum
CREATE TYPE "VisitAssessmentStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "VisitAssessment" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByUsername" TEXT NOT NULL,
    "chiefComplaint" TEXT,
    "examination" TEXT,
    "diagnosis" TEXT,
    "summary" TEXT,
    "prescription" TEXT,
    "advice" TEXT,
    "followUpAt" TIMESTAMP(3),
    "status" "VisitAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitAssessment_appointmentId_key" ON "VisitAssessment"("appointmentId");

-- CreateIndex
CREATE INDEX "VisitAssessment_hospitalId_status_updatedAt_idx" ON "VisitAssessment"("hospitalId", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "VisitAssessment" ADD CONSTRAINT "VisitAssessment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssessment" ADD CONSTRAINT "VisitAssessment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssessment" ADD CONSTRAINT "VisitAssessment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
