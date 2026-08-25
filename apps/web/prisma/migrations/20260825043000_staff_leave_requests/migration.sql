-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'EARNED', 'EMERGENCY', 'OTHER');

-- CreateTable
CREATE TABLE "StaffLeave" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "type" "LeaveType" NOT NULL DEFAULT 'CASUAL',
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "StaffLeave_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffLeave_hospitalId_status_startAt_idx" ON "StaffLeave"("hospitalId", "status", "startAt");
CREATE INDEX "StaffLeave_staffId_startAt_idx" ON "StaffLeave"("staffId", "startAt");

ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Copy existing doctor leave as approved records
INSERT INTO "StaffLeave" ("id", "hospitalId", "staffId", "requestedByUserId", "type", "status", "startAt", "endAt", "reason", "createdAt", "reviewedAt")
SELECT d."id", d."hospitalId", d."doctorId", s."appUserId", 'OTHER', 'APPROVED', d."startAt", d."endAt", d."reason", d."createdAt", d."createdAt"
FROM "DoctorLeave" d
LEFT JOIN "Staff" s ON s."id" = d."doctorId";

DROP TABLE "DoctorLeave";
