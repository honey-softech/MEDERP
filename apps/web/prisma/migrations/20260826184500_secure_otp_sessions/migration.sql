-- AlterTable
ALTER TABLE "AppUser" ALTER COLUMN "otpCode" DROP NOT NULL;
ALTER TABLE "AppUser" ALTER COLUMN "otpCode" DROP DEFAULT;
UPDATE "AppUser" SET "otpCode" = NULL WHERE "otpCode" = '1234';

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN "otpExpiresAt" TIMESTAMP(3);
ALTER TABLE "AppUser" ADD COLUMN "otpAttempts" INTEGER NOT NULL DEFAULT 0;

-- Invalidate legacy plaintext session tokens (re-issued as SHA-256 hashes on next login)
DELETE FROM "AppSession";
