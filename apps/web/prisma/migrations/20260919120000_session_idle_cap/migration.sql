-- AlterTable
ALTER TABLE "AppSession" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "AppSession_userId_lastSeenAt_idx" ON "AppSession"("userId", "lastSeenAt");
