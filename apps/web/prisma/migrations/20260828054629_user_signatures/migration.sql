-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- DropIndex
DROP INDEX "DrugCatalog_name_trgm_idx";

-- DropIndex
DROP INDEX "DrugCatalog_searchText_trgm_idx";

-- DropIndex
DROP INDEX "DrugManufacturer_searchText_trgm_idx";

-- AlterTable
ALTER TABLE "Admission" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Bed" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN     "requireSignatureForApproval" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "includedStaffSlots" SET DEFAULT 6;

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN     "orderedBySignatureId" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LabOrderItem" ALTER COLUMN "nameSnapshot" DROP DEFAULT,
ALTER COLUMN "categorySnapshot" DROP DEFAULT,
ALTER COLUMN "unitPrice" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receivedBySignatureId" TEXT;

-- AlterTable
ALTER TABLE "VisitAssessment" ADD COLUMN     "approvedByCredentials" TEXT,
ADD COLUMN     "approvedByDisplayName" TEXT,
ADD COLUMN     "approvedBySignatureId" TEXT;

-- AlterTable
ALTER TABLE "Ward" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "UserSignature" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "credentials" TEXT,
    "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedByUsername" TEXT NOT NULL,
    "verifiedByUserId" TEXT,
    "verifiedByUsername" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSignature_hospitalId_userId_status_idx" ON "UserSignature"("hospitalId", "userId", "status");

-- AddForeignKey
ALTER TABLE "UserSignature" ADD CONSTRAINT "UserSignature_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSignature" ADD CONSTRAINT "UserSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssessment" ADD CONSTRAINT "VisitAssessment_approvedBySignatureId_fkey" FOREIGN KEY ("approvedBySignatureId") REFERENCES "UserSignature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_orderedBySignatureId_fkey" FOREIGN KEY ("orderedBySignatureId") REFERENCES "UserSignature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedBySignatureId_fkey" FOREIGN KEY ("receivedBySignatureId") REFERENCES "UserSignature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
