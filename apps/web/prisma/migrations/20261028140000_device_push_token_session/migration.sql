-- AlterTable
ALTER TABLE "DevicePushToken" ADD COLUMN "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "DevicePushToken_sessionId_idx" ON "DevicePushToken"("sessionId");

-- AddForeignKey
ALTER TABLE "DevicePushToken" ADD CONSTRAINT "DevicePushToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AppSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
