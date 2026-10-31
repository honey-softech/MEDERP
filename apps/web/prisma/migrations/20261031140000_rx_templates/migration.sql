-- CreateTable
CREATE TABLE "RxTemplate" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "prescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RxTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RxTemplate_hospitalId_doctorId_idx" ON "RxTemplate"("hospitalId", "doctorId");

-- CreateIndex
CREATE INDEX "RxTemplate_doctorId_diagnosis_idx" ON "RxTemplate"("doctorId", "diagnosis");

-- AddForeignKey
ALTER TABLE "RxTemplate" ADD CONSTRAINT "RxTemplate_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RxTemplate" ADD CONSTRAINT "RxTemplate_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
