-- CreateTable
CREATE TABLE "VisitVitals" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByUsername" TEXT NOT NULL,
    "heightCm" DECIMAL(6,2) NOT NULL,
    "weightKg" DECIMAL(6,2) NOT NULL,
    "bmi" DECIMAL(5,1) NOT NULL,
    "temperatureC" DECIMAL(4,1) NOT NULL,
    "hasFever" BOOLEAN NOT NULL,
    "spo2Percent" INTEGER NOT NULL,
    "pulseBpm" INTEGER NOT NULL,
    "respiratoryRate" INTEGER NOT NULL,
    "bpSystolic" INTEGER NOT NULL,
    "bpDiastolic" INTEGER NOT NULL,
    "bloodSugarMgDl" DECIMAL(6,1),
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitVitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitVitals_appointmentId_key" ON "VisitVitals"("appointmentId");

-- CreateIndex
CREATE INDEX "VisitVitals_hospitalId_recordedAt_idx" ON "VisitVitals"("hospitalId", "recordedAt");

-- CreateIndex
CREATE INDEX "StaffNotification_userId_isRead_createdAt_idx" ON "StaffNotification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_hospitalId_createdAt_idx" ON "StaffNotification"("hospitalId", "createdAt");

-- AddForeignKey
ALTER TABLE "VisitVitals" ADD CONSTRAINT "VisitVitals_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitVitals" ADD CONSTRAINT "VisitVitals_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitVitals" ADD CONSTRAINT "VisitVitals_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
