-- CreateTable
CREATE TABLE "StaffAvailabilityWindow" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAvailabilityWindow_staffId_dayOfWeek_idx" ON "StaffAvailabilityWindow"("staffId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "StaffAvailabilityWindow" ADD CONSTRAINT "StaffAvailabilityWindow_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
