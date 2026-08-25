-- CreateEnum
CREATE TYPE "PlatformInvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'VOID');

-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN "includedStaffSlots" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Hospital" ADD COLUMN "extraStaffSlots" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Hospital" ADD COLUMN "pharmacyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Hospital" ADD COLUMN "labEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlatformBillingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT 'MedERP Software Pvt Ltd',
    "companyAddress" TEXT,
    "companyPhone" TEXT,
    "companyEmail" TEXT,
    "gstin" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'MEDERP',
    "bankDetails" TEXT,
    "termsNote" TEXT,
    "basePackageFee" DECIMAL(12,2) NOT NULL DEFAULT 4000,
    "includedStaffSlots" INTEGER NOT NULL DEFAULT 3,
    "extraUserFee" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "pharmacyModuleFee" DECIMAL(12,2) NOT NULL DEFAULT 1000,
    "labModuleFee" DECIMAL(12,2) NOT NULL DEFAULT 1000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBillingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCounter" (
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlatformCounter_pkey" PRIMARY KEY ("kind")
);

-- CreateTable
CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "status" "PlatformInvoiceStatus" NOT NULL DEFAULT 'PAID',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "netTotal" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PlatformInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_invoiceNo_key" ON "PlatformInvoice"("invoiceNo");
CREATE INDEX "PlatformInvoice_hospitalId_issuedAt_idx" ON "PlatformInvoice"("hospitalId", "issuedAt");

-- AddForeignKey
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformInvoiceLine" ADD CONSTRAINT "PlatformInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default billing settings
INSERT INTO "PlatformBillingSettings" ("id", "companyName", "updatedAt")
VALUES ('default', 'MedERP Software Pvt Ltd', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PlatformCounter" ("kind", "value") VALUES ('platform_invoice', 0)
ON CONFLICT ("kind") DO NOTHING;
