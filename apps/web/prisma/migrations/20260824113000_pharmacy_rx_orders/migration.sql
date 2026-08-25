-- CreateEnum
CREATE TYPE "PharmacyRxStatus" AS ENUM ('AWAITING_PAYMENT', 'DISPENSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PharmacyRxOrder" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" "PharmacyRxStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orderedByUsername" TEXT,
    "paidAt" TIMESTAMP(3),
    "dispensedAt" TIMESTAMP(3),
    "dispensedByUserId" TEXT,
    "dispensedByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyRxOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PharmacyRxLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "doseNotes" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pharmacyItemId" TEXT,
    "batchId" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "inStock" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PharmacyRxLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PharmacyRxOrder_appointmentId_key" ON "PharmacyRxOrder"("appointmentId");
CREATE INDEX "PharmacyRxOrder_hospitalId_status_createdAt_idx" ON "PharmacyRxOrder"("hospitalId", "status", "createdAt");
CREATE INDEX "PharmacyRxLine_orderId_idx" ON "PharmacyRxLine"("orderId");

ALTER TABLE "PharmacyRxOrder" ADD CONSTRAINT "PharmacyRxOrder_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyRxOrder" ADD CONSTRAINT "PharmacyRxOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyRxOrder" ADD CONSTRAINT "PharmacyRxOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PharmacyRxOrder" ADD CONSTRAINT "PharmacyRxOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PharmacyRxLine" ADD CONSTRAINT "PharmacyRxLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PharmacyRxOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyRxLine" ADD CONSTRAINT "PharmacyRxLine_pharmacyItemId_fkey" FOREIGN KEY ("pharmacyItemId") REFERENCES "PharmacyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PharmacyRxLine" ADD CONSTRAINT "PharmacyRxLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
