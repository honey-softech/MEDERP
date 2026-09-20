-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN "followUpReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Hospital" ADD COLUMN "followUpReminderDaysBefore" INTEGER NOT NULL DEFAULT 1;

-- AlterEnum
ALTER TYPE "ReminderStatus" ADD VALUE 'CANCELLED';

-- CreateEnum
CREATE TYPE "ReminderSource" AS ENUM ('MANUAL', 'FOLLOW_UP');

-- AlterTable
ALTER TABLE "AppointmentReminder" ADD COLUMN "source" "ReminderSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "AppointmentReminder" ADD COLUMN "visitAt" TIMESTAMP(3);
ALTER TABLE "AppointmentReminder" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AppointmentReminder_status_scheduledFor_idx" ON "AppointmentReminder"("status", "scheduledFor");
CREATE INDEX "AppointmentReminder_appointmentId_status_source_idx" ON "AppointmentReminder"("appointmentId", "status", "source");
