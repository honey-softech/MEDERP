-- Stage 2: helpdesk agents escalate tickets that need software-admin tools.
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'ESCALATED';

ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "escalatedById" TEXT;
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "escalationReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HelpdeskTicket_escalatedById_fkey'
  ) THEN
    ALTER TABLE "HelpdeskTicket"
      ADD CONSTRAINT "HelpdeskTicket_escalatedById_fkey"
      FOREIGN KEY ("escalatedById") REFERENCES "AppUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "HelpdeskTicket_status_escalatedAt_idx"
  ON "HelpdeskTicket"("status", "escalatedAt");
