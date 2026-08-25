-- AlterEnum
ALTER TYPE "AppRole" ADD VALUE 'HELPDESK';

-- CreateEnum
CREATE TYPE "HospitalJoinStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HelpdeskTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_REPLY', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HelpdeskTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "StaffNotification" ALTER COLUMN "hospitalId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "HospitalJoinRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "requestedRole" "AppRole" NOT NULL,
    "note" TEXT,
    "status" "HospitalJoinStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpdeskTicket" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "hospitalId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "HelpdeskTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "HelpdeskTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpdeskMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpdeskMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HospitalJoinRequest_hospitalId_status_createdAt_idx" ON "HospitalJoinRequest"("hospitalId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "HospitalJoinRequest_userId_status_idx" ON "HospitalJoinRequest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HelpdeskTicket_number_key" ON "HelpdeskTicket"("number");

-- CreateIndex
CREATE INDEX "HelpdeskTicket_hospitalId_status_updatedAt_idx" ON "HelpdeskTicket"("hospitalId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "HelpdeskTicket_createdById_updatedAt_idx" ON "HelpdeskTicket"("createdById", "updatedAt");

-- CreateIndex
CREATE INDEX "HelpdeskTicket_assignedToId_status_idx" ON "HelpdeskTicket"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "HelpdeskMessage_ticketId_createdAt_idx" ON "HelpdeskMessage"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "HospitalJoinRequest" ADD CONSTRAINT "HospitalJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalJoinRequest" ADD CONSTRAINT "HospitalJoinRequest_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalJoinRequest" ADD CONSTRAINT "HospitalJoinRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskMessage" ADD CONSTRAINT "HelpdeskMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskMessage" ADD CONSTRAINT "HelpdeskMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
