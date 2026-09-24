-- CreateEnum
CREATE TYPE "HospitalReferralStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "HospitalReferral" (
    "id" TEXT NOT NULL,
    "referrerHospitalId" TEXT NOT NULL,
    "referredHospitalId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" "HospitalReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rewardMonths" INTEGER NOT NULL DEFAULT 0,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalReferral_referredHospitalId_key" ON "HospitalReferral"("referredHospitalId");

-- CreateIndex
CREATE INDEX "HospitalReferral_referrerHospitalId_status_idx" ON "HospitalReferral"("referrerHospitalId", "status");

-- CreateIndex
CREATE INDEX "HospitalReferral_status_createdAt_idx" ON "HospitalReferral"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "HospitalReferral" ADD CONSTRAINT "HospitalReferral_referrerHospitalId_fkey" FOREIGN KEY ("referrerHospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalReferral" ADD CONSTRAINT "HospitalReferral_referredHospitalId_fkey" FOREIGN KEY ("referredHospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
