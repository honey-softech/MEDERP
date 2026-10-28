-- CreateEnum
CREATE TYPE "PayBasis" AS ENUM ('MONTHLY', 'DAILY');

-- CreateEnum
CREATE TYPE "MonthDivisor" AS ENUM ('FIXED_30', 'CALENDAR_DAYS');

-- CreateEnum
CREATE TYPE "TimesheetDayKind" AS ENUM ('WORKED', 'HALF_DAY', 'CASUAL_LEAVE', 'SICK_LEAVE', 'ABSENT');

-- CreateEnum
CREATE TYPE "TimesheetWeekStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED');

-- CreateTable
CREATE TABLE "StaffPayProfile" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "payBasis" "PayBasis" NOT NULL DEFAULT 'MONTHLY',
    "monthlyAmount" DECIMAL(12,2),
    "dailyRate" DECIMAL(12,2),
    "monthDivisor" "MonthDivisor" NOT NULL DEFAULT 'FIXED_30',
    "casualLeaveDays" INTEGER NOT NULL DEFAULT 0,
    "sickLeaveDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalPayrollSettings" (
    "hospitalId" TEXT NOT NULL,
    "weeklyOffDays" TEXT NOT NULL DEFAULT '0',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalPayrollSettings_pkey" PRIMARY KEY ("hospitalId")
);

-- CreateTable
CREATE TABLE "HospitalHoliday" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetDay" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "TimesheetDayKind" NOT NULL DEFAULT 'WORKED',
    "clockIn" TEXT,
    "clockOut" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetWeek" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" "TimesheetWeekStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollSundayNotice" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollSundayNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayProfile_staffId_key" ON "StaffPayProfile"("staffId");

-- CreateIndex
CREATE INDEX "StaffPayProfile_hospitalId_idx" ON "StaffPayProfile"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalHoliday_hospitalId_date_idx" ON "HospitalHoliday"("hospitalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalHoliday_hospitalId_date_key" ON "HospitalHoliday"("hospitalId", "date");

-- CreateIndex
CREATE INDEX "TimesheetDay_hospitalId_date_idx" ON "TimesheetDay"("hospitalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetDay_staffId_date_key" ON "TimesheetDay"("staffId", "date");

-- CreateIndex
CREATE INDEX "TimesheetWeek_hospitalId_status_weekStart_idx" ON "TimesheetWeek"("hospitalId", "status", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetWeek_staffId_weekStart_key" ON "TimesheetWeek"("staffId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSundayNotice_hospitalId_weekStart_key" ON "PayrollSundayNotice"("hospitalId", "weekStart");

-- AddForeignKey
ALTER TABLE "StaffPayProfile" ADD CONSTRAINT "StaffPayProfile_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayProfile" ADD CONSTRAINT "StaffPayProfile_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalPayrollSettings" ADD CONSTRAINT "HospitalPayrollSettings_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalHoliday" ADD CONSTRAINT "HospitalHoliday_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDay" ADD CONSTRAINT "TimesheetDay_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDay" ADD CONSTRAINT "TimesheetDay_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetWeek" ADD CONSTRAINT "TimesheetWeek_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetWeek" ADD CONSTRAINT "TimesheetWeek_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSundayNotice" ADD CONSTRAINT "PayrollSundayNotice_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
