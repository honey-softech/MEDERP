-- Locked-out users can open tickets without a session; contact fields capture identity.
ALTER TABLE "HelpdeskTicket" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "contactMobile" TEXT;
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "contactName" TEXT;

CREATE INDEX IF NOT EXISTS "HelpdeskTicket_contactMobile_createdAt_idx"
  ON "HelpdeskTicket"("contactMobile", "createdAt");
