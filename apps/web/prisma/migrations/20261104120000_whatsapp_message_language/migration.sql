-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN "whatsappLanguage" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "whatsappLanguage" TEXT;
