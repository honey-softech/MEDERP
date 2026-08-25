-- CreateEnum
CREATE TYPE "PharmacyLedgerKind" AS ENUM ('GRN_IN', 'SALE_OUT', 'ADJUST_EXPIRED', 'ADJUST_DAMAGED', 'ADJUST_RETURN', 'ADJUST_CORRECTION');

-- CreateTable
CREATE TABLE "PharmacyItem" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "manufacturer" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'tablet',
    "barcode" TEXT,
    "hsnCode" TEXT,
    "gstPercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "reorderQty" INTEGER NOT NULL DEFAULT 50,
    "mrp" DECIMAL(10,2),
    "catalogDrugId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PharmacySupplier" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "gstin" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacySupplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PharmacyBatch" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierId" TEXT,
    "batchNo" TEXT NOT NULL,
    "mfgDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "purchaseRate" DECIMAL(10,2) NOT NULL,
    "mrp" DECIMAL(10,2) NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "quantityAvailable" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PharmacyGrn" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "supplierId" TEXT,
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "notes" TEXT,
    "receivedByUserId" TEXT,
    "receivedByUsername" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyGrn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PharmacyGrnLine" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchaseRate" DECIMAL(10,2) NOT NULL,
    "mrp" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PharmacyGrnLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PharmacyLedger" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "kind" "PharmacyLedgerKind" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "actorUserId" TEXT,
    "actorUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PharmacyItem_hospitalId_barcode_key" ON "PharmacyItem"("hospitalId", "barcode");
CREATE INDEX "PharmacyItem_hospitalId_name_idx" ON "PharmacyItem"("hospitalId", "name");
CREATE INDEX "PharmacyItem_hospitalId_isActive_idx" ON "PharmacyItem"("hospitalId", "isActive");
CREATE INDEX "PharmacySupplier_hospitalId_name_idx" ON "PharmacySupplier"("hospitalId", "name");
CREATE UNIQUE INDEX "PharmacyBatch_hospitalId_itemId_batchNo_key" ON "PharmacyBatch"("hospitalId", "itemId", "batchNo");
CREATE INDEX "PharmacyBatch_hospitalId_expiryDate_idx" ON "PharmacyBatch"("hospitalId", "expiryDate");
CREATE INDEX "PharmacyBatch_itemId_quantityAvailable_idx" ON "PharmacyBatch"("itemId", "quantityAvailable");
CREATE INDEX "PharmacyGrn_hospitalId_receivedAt_idx" ON "PharmacyGrn"("hospitalId", "receivedAt");
CREATE INDEX "PharmacyGrnLine_grnId_idx" ON "PharmacyGrnLine"("grnId");
CREATE INDEX "PharmacyLedger_hospitalId_createdAt_idx" ON "PharmacyLedger"("hospitalId", "createdAt");
CREATE INDEX "PharmacyLedger_batchId_createdAt_idx" ON "PharmacyLedger"("batchId", "createdAt");

ALTER TABLE "PharmacyItem" ADD CONSTRAINT "PharmacyItem_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacySupplier" ADD CONSTRAINT "PharmacySupplier_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyBatch" ADD CONSTRAINT "PharmacyBatch_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyBatch" ADD CONSTRAINT "PharmacyBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PharmacyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PharmacyBatch" ADD CONSTRAINT "PharmacyBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PharmacyGrn" ADD CONSTRAINT "PharmacyGrn_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyGrn" ADD CONSTRAINT "PharmacyGrn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PharmacyGrnLine" ADD CONSTRAINT "PharmacyGrnLine_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "PharmacyGrn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyGrnLine" ADD CONSTRAINT "PharmacyGrnLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PharmacyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PharmacyGrnLine" ADD CONSTRAINT "PharmacyGrnLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PharmacyLedger" ADD CONSTRAINT "PharmacyLedger_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyLedger" ADD CONSTRAINT "PharmacyLedger_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PharmacyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PharmacyLedger" ADD CONSTRAINT "PharmacyLedger_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
