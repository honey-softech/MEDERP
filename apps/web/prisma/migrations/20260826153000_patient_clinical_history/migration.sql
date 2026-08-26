-- Patient clinical history for consult context panel
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "allergies" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "medicalHistory" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "familyHistory" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "socialHistory" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "currentMedications" TEXT;

-- Visit outcome: FOLLOW_UP | DISCHARGE
ALTER TABLE "VisitAssessment" ADD COLUMN IF NOT EXISTS "visitOutcome" TEXT;
