-- AlterTable
ALTER TABLE "VisitAssessment" ADD COLUMN "entryMode" TEXT NOT NULL DEFAULT 'TYPED';
ALTER TABLE "VisitAssessment" ADD COLUMN "handwritingPages" TEXT;
