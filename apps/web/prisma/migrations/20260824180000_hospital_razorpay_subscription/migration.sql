-- CreateEnum
CREATE TYPE "HospitalSubscriptionStatus" AS ENUM ('CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'HALTED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

-- AlterTable PlatformInvoice
ALTER TABLE "PlatformInvoice" ADD COLUMN "razorpayPaymentId" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "razorpaySubscriptionId" TEXT;
CREATE UNIQUE INDEX "PlatformInvoice_razorpayPaymentId_key" ON "PlatformInvoice"("razorpayPaymentId");

-- CreateTable
CREATE TABLE "HospitalSubscription" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "razorpayPlanId" TEXT NOT NULL,
    "razorpaySubscriptionId" TEXT NOT NULL,
    "status" "HospitalSubscriptionStatus" NOT NULL DEFAULT 'CREATED',
    "monthlyAmount" DECIMAL(12,2) NOT NULL,
    "pendingMonthlyAmount" DECIMAL(12,2),
    "pendingPlanId" TEXT,
    "pendingExtraStaffSlots" INTEGER NOT NULL DEFAULT 0,
    "pendingPharmacyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pendingLabEnabled" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextChargeAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HospitalSubscription_hospitalId_key" ON "HospitalSubscription"("hospitalId");
CREATE UNIQUE INDEX "HospitalSubscription_razorpaySubscriptionId_key" ON "HospitalSubscription"("razorpaySubscriptionId");
CREATE INDEX "HospitalSubscription_razorpaySubscriptionId_idx" ON "HospitalSubscription"("razorpaySubscriptionId");

ALTER TABLE "HospitalSubscription" ADD CONSTRAINT "HospitalSubscription_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
