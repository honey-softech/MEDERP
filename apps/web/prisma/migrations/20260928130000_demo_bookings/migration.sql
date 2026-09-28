CREATE TYPE "DemoBookingStatus" AS ENUM ('BOOKED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "DemoCalendarStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

CREATE TABLE "DemoSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "durationMins" INTEGER NOT NULL DEFAULT 30,
    "bufferMins" INTEGER NOT NULL DEFAULT 15,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "lookAheadDays" INTEGER NOT NULL DEFAULT 14,
    "dayStartMin" INTEGER NOT NULL DEFAULT 600,
    "dayEndMin" INTEGER NOT NULL DEFAULT 1080,
    "notifyEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DemoSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);

CREATE TABLE "DemoCalendarConnection" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "status" "DemoCalendarStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "googleEmail" TEXT,
    "refreshTokenEnc" TEXT,
    "connectedByUserId" TEXT,
    "connectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DemoBooking" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "organization" TEXT,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "DemoBookingStatus" NOT NULL DEFAULT 'BOOKED',
    "googleEventId" TEXT,
    "meetLink" TEXT,
    "cancelToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DemoBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoBooking_cancelToken_key" ON "DemoBooking"("cancelToken");
CREATE INDEX "DemoBooking_status_startsAt_idx" ON "DemoBooking"("status", "startsAt");
CREATE INDEX "DemoBooking_email_createdAt_idx" ON "DemoBooking"("email", "createdAt");
CREATE UNIQUE INDEX "DemoBooking_active_slot_key" ON "DemoBooking"("startsAt") WHERE "status" = 'BOOKED';
