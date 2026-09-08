-- CreateEnum
CREATE TYPE "MedicalCertificateType" AS ENUM ('SICK_LEAVE', 'FITNESS', 'GENERAL');

-- CreateEnum
CREATE TYPE "MedicalCertificateStatus" AS ENUM ('ISSUED', 'VOIDED');

-- CreateTable
CREATE TABLE "MedicalCertificate" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "issuedByStaffId" TEXT,
    "certificateNo" TEXT NOT NULL,
    "type" "MedicalCertificateType" NOT NULL,
    "status" "MedicalCertificateStatus" NOT NULL DEFAULT 'ISSUED',
    "diagnosis" TEXT NOT NULL,
    "remarks" TEXT,
    "restFrom" TIMESTAMP(3),
    "restTo" TIMESTAMP(3),
    "fitFor" TEXT,
    "purpose" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByUserId" TEXT NOT NULL,
    "issuedByUsername" TEXT NOT NULL,
    "issuedByDisplayName" TEXT,
    "issuedByCredentials" TEXT,
    "issuedBySignatureId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalCertificate_hospitalId_certificateNo_key" ON "MedicalCertificate"("hospitalId", "certificateNo");

-- CreateIndex
CREATE INDEX "MedicalCertificate_hospitalId_issuedAt_idx" ON "MedicalCertificate"("hospitalId", "issuedAt");

-- CreateIndex
CREATE INDEX "MedicalCertificate_patientId_issuedAt_idx" ON "MedicalCertificate"("patientId", "issuedAt");

-- AddForeignKey
ALTER TABLE "MedicalCertificate" ADD CONSTRAINT "MedicalCertificate_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCertificate" ADD CONSTRAINT "MedicalCertificate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCertificate" ADD CONSTRAINT "MedicalCertificate_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCertificate" ADD CONSTRAINT "MedicalCertificate_issuedByStaffId_fkey" FOREIGN KEY ("issuedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCertificate" ADD CONSTRAINT "MedicalCertificate_issuedBySignatureId_fkey" FOREIGN KEY ("issuedBySignatureId") REFERENCES "UserSignature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
