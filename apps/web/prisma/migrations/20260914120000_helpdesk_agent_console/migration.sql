-- CreateEnum
CREATE TYPE "HelpdeskMessageKind" AS ENUM ('PUBLIC', 'INTERNAL', 'SYSTEM');

-- AlterTable HelpdeskTicket: SLA + lifecycle columns
ALTER TABLE "HelpdeskTicket" ADD COLUMN "firstResponseDueAt" TIMESTAMP(3);
ALTER TABLE "HelpdeskTicket" ADD COLUMN "resolutionDueAt" TIMESTAMP(3);
ALTER TABLE "HelpdeskTicket" ADD COLUMN "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "HelpdeskTicket" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "HelpdeskTicket" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "HelpdeskTicket" ADD COLUMN "lastAgentReplyAt" TIMESTAMP(3);
ALTER TABLE "HelpdeskTicket" ADD COLUMN "lastRequesterReplyAt" TIMESTAMP(3);
ALTER TABLE "HelpdeskTicket" ADD COLUMN "reopenedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable HelpdeskMessage: kind
ALTER TABLE "HelpdeskMessage" ADD COLUMN "kind" "HelpdeskMessageKind" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "HelpdeskCannedReply" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "createdById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskCannedReply_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "HelpdeskTicket_status_firstResponseDueAt_idx" ON "HelpdeskTicket"("status", "firstResponseDueAt");
CREATE INDEX "HelpdeskMessage_ticketId_kind_createdAt_idx" ON "HelpdeskMessage"("ticketId", "kind", "createdAt");
CREATE INDEX "HelpdeskCannedReply_isActive_category_idx" ON "HelpdeskCannedReply"("isActive", "category");

-- Foreign keys
ALTER TABLE "HelpdeskCannedReply" ADD CONSTRAINT "HelpdeskCannedReply_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: mark support-action and escalation notes as SYSTEM
UPDATE "HelpdeskMessage"
SET "kind" = 'SYSTEM'
WHERE "body" LIKE 'Support action:%'
   OR "body" LIKE 'Escalated to software admin:%';

-- Backfill: terminal ticket timestamps from updatedAt
UPDATE "HelpdeskTicket"
SET "resolvedAt" = "updatedAt"
WHERE "status" = 'RESOLVED' AND "resolvedAt" IS NULL;

UPDATE "HelpdeskTicket"
SET "closedAt" = "updatedAt",
    "resolvedAt" = COALESCE("resolvedAt", "updatedAt")
WHERE "status" = 'CLOSED' AND "closedAt" IS NULL;
