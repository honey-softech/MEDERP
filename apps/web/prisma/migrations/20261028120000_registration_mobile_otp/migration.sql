-- CreateTable
CREATE TABLE "RegistrationMobileOtp" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "proofToken" TEXT,
    "proofExpiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationMobileOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationMobileOtp_proofToken_key" ON "RegistrationMobileOtp"("proofToken");

-- CreateIndex
CREATE INDEX "RegistrationMobileOtp_mobile_purpose_createdAt_idx" ON "RegistrationMobileOtp"("mobile", "purpose", "createdAt");
