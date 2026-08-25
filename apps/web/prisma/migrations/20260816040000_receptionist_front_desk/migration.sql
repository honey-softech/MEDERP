-- CreateEnum
CREATE TYPE "QueueType" AS ENUM ('SCHEDULED', 'WALK_IN');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('NEW', 'FOLLOW_UP', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('SELF', 'DOCTOR', 'INSURANCE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'INSURANCE', 'ADVANCE');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('COLLECTION', 'ADVANCE', 'REFUND');

-- CreateEnum
CREATE TYPE "WaiverStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "FamilyRelation" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "IdProofType" AS ENUM ('AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'OTHER');

-- Attach existing clinical rows to a hospital. Create a fallback only if data exists without one.
INSERT INTO "Hospital" ("id", "name", "code", "isActive", "createdAt", "updatedAt")
SELECT 'seed-hospital-fallback', 'Demo Hospital', 'DEMOHSP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Hospital")
AND (
  EXISTS (SELECT 1 FROM "Department")
  OR EXISTS (SELECT 1 FROM "Staff")
  OR EXISTS (SELECT 1 FROM "Patient")
  OR EXISTS (SELECT 1 FROM "Appointment")
  OR EXISTS (SELECT 1 FROM "Invoice")
);

-- HospitalCounter
CREATE TABLE "HospitalCounter" (
    "hospitalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HospitalCounter_pkey" PRIMARY KEY ("hospitalId","kind")
);

-- Department: hospital scope
ALTER TABLE "Department" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "Department" ADD COLUMN "consultationFee" DECIMAL(12,2) NOT NULL DEFAULT 500;

UPDATE "Department" SET "hospitalId" = (SELECT "id" FROM "Hospital" ORDER BY "createdAt" ASC LIMIT 1);

ALTER TABLE "Department" ALTER COLUMN "hospitalId" SET NOT NULL;

DROP INDEX "Department_name_key";
DROP INDEX "Department_code_key";
CREATE UNIQUE INDEX "Department_hospitalId_code_key" ON "Department"("hospitalId", "code");

-- Staff: hospital scope
ALTER TABLE "Staff" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "Staff" ADD COLUMN "appUserId" TEXT;
ALTER TABLE "Staff" ADD COLUMN "consultationFee" DECIMAL(12,2);
ALTER TABLE "Staff" ALTER COLUMN "passwordHash" SET DEFAULT 'linked-account';

UPDATE "Staff" SET "hospitalId" = (SELECT "id" FROM "Hospital" ORDER BY "createdAt" ASC LIMIT 1);

ALTER TABLE "Staff" ALTER COLUMN "hospitalId" SET NOT NULL;

DROP INDEX "Staff_email_key";
CREATE UNIQUE INDEX "Staff_appUserId_key" ON "Staff"("appUserId");
CREATE UNIQUE INDEX "Staff_hospitalId_email_key" ON "Staff"("hospitalId", "email");

-- Patient: hospital scope + registration fields
ALTER TABLE "Patient" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "Patient" ADD COLUMN "idProofType" "IdProofType";
ALTER TABLE "Patient" ADD COLUMN "idProofNumber" TEXT;
ALTER TABLE "Patient" ADD COLUMN "insuranceProvider" TEXT;
ALTER TABLE "Patient" ADD COLUMN "insurancePolicyNo" TEXT;
ALTER TABLE "Patient" ADD COLUMN "insuranceValidUntil" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN "advanceBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Patient" ADD COLUMN "mergedIntoId" TEXT;

UPDATE "Patient" SET "hospitalId" = (SELECT "id" FROM "Hospital" ORDER BY "createdAt" ASC LIMIT 1);

ALTER TABLE "Patient" ALTER COLUMN "hospitalId" SET NOT NULL;

DROP INDEX "Patient_mrn_key";
CREATE UNIQUE INDEX "Patient_hospitalId_mrn_key" ON "Patient"("hospitalId", "mrn");
CREATE INDEX "Patient_hospitalId_phone_idx" ON "Patient"("hospitalId", "phone");
CREATE INDEX "Patient_hospitalId_lastName_firstName_idx" ON "Patient"("hospitalId", "lastName", "firstName");

-- Appointment: hospital scope + front-desk fields
ALTER TABLE "Appointment" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "queueType" "QueueType" NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "Appointment" ADD COLUMN "visitType" "VisitType" NOT NULL DEFAULT 'NEW';
ALTER TABLE "Appointment" ADD COLUMN "referralSource" "ReferralSource" NOT NULL DEFAULT 'SELF';
ALTER TABLE "Appointment" ADD COLUMN "referredBy" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "tokenNumber" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN "checkInAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "checkOutAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

UPDATE "Appointment" SET "hospitalId" = (SELECT "id" FROM "Hospital" ORDER BY "createdAt" ASC LIMIT 1);

ALTER TABLE "Appointment" ALTER COLUMN "hospitalId" SET NOT NULL;

CREATE INDEX "Appointment_hospitalId_scheduledAt_idx" ON "Appointment"("hospitalId", "scheduledAt");
CREATE INDEX "Appointment_hospitalId_doctorId_scheduledAt_idx" ON "Appointment"("hospitalId", "doctorId", "scheduledAt");

-- Invoice: hospital scope + billing fields
ALTER TABLE "Invoice" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "invoiceNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "subtotal" DECIMAL(12,2);
ALTER TABLE "Invoice" ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "waiverAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "waiverStatus" "WaiverStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Invoice" ADD COLUMN "waiverReason" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "netTotal" DECIMAL(12,2);
ALTER TABLE "Invoice" ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Invoice" SET
  "hospitalId" = (SELECT "id" FROM "Hospital" ORDER BY "createdAt" ASC LIMIT 1),
  "subtotal" = "total",
  "netTotal" = "total",
  "invoiceNo" = 'INV-LEGACY-' || SUBSTRING("id", 1, 8);

ALTER TABLE "Invoice" ALTER COLUMN "hospitalId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNo" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "subtotal" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "netTotal" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'ISSUED';

ALTER TABLE "Invoice" DROP COLUMN "total";

CREATE UNIQUE INDEX "Invoice_hospitalId_invoiceNo_key" ON "Invoice"("hospitalId", "invoiceNo");

-- PatientFamily
CREATE TABLE "PatientFamily" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "primaryPatientId" TEXT NOT NULL,
    "relatedPatientId" TEXT NOT NULL,
    "relation" "FamilyRelation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientFamily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientFamily_primaryPatientId_relatedPatientId_key" ON "PatientFamily"("primaryPatientId", "relatedPatientId");

-- DoctorLeave
CREATE TABLE "DoctorLeave" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorLeave_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoctorLeave_hospitalId_doctorId_startAt_idx" ON "DoctorLeave"("hospitalId", "doctorId", "startAt");

-- AppointmentReminder
CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "kind" "PaymentKind" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "receivedByUserId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "HospitalCounter" ADD CONSTRAINT "HospitalCounter_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Department" ADD CONSTRAINT "Department_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Staff" ADD CONSTRAINT "Staff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientFamily" ADD CONSTRAINT "PatientFamily_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientFamily" ADD CONSTRAINT "PatientFamily_primaryPatientId_fkey" FOREIGN KEY ("primaryPatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientFamily" ADD CONSTRAINT "PatientFamily_relatedPatientId_fkey" FOREIGN KEY ("relatedPatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DoctorLeave" ADD CONSTRAINT "DoctorLeave_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DoctorLeave" ADD CONSTRAINT "DoctorLeave_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
