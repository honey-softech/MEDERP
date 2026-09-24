-- Platform subscription invoices keep the billing-settings letterhead from issue time.
ALTER TABLE "PlatformInvoice" ADD COLUMN "issuerName" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "issuerAddress" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "issuerPhone" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "issuerEmail" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "issuerGstin" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "issuerBankDetails" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "issuerTermsNote" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "billedHospitalName" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "billedHospitalCode" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "billedHospitalAddress" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN "billedHospitalPhone" TEXT;

UPDATE "PlatformInvoice" AS invoice
SET
  "issuerName" = settings."companyName",
  "issuerAddress" = settings."companyAddress",
  "issuerPhone" = settings."companyPhone",
  "issuerEmail" = settings."companyEmail",
  "issuerGstin" = settings."gstin",
  "issuerBankDetails" = settings."bankDetails",
  "issuerTermsNote" = settings."termsNote"
FROM "PlatformBillingSettings" AS settings
WHERE settings."id" = 'default'
  AND invoice."issuerName" IS NULL;

UPDATE "PlatformInvoice" AS invoice
SET
  "billedHospitalName" = hospital."name",
  "billedHospitalCode" = hospital."code",
  "billedHospitalAddress" = hospital."address",
  "billedHospitalPhone" = hospital."phone"
FROM "Hospital" AS hospital
WHERE hospital."id" = invoice."hospitalId"
  AND invoice."billedHospitalName" IS NULL;

-- Approved visit summaries keep the hospital letterhead and signature from approval time.
ALTER TABLE "VisitAssessment" ADD COLUMN "approvedBySignatureImage" TEXT;
ALTER TABLE "VisitAssessment" ADD COLUMN "issuedHospitalName" TEXT;
ALTER TABLE "VisitAssessment" ADD COLUMN "issuedHospitalCode" TEXT;
ALTER TABLE "VisitAssessment" ADD COLUMN "issuedHospitalAddress" TEXT;
ALTER TABLE "VisitAssessment" ADD COLUMN "issuedHospitalPhone" TEXT;
ALTER TABLE "VisitAssessment" ADD COLUMN "issuedLogoData" TEXT;
ALTER TABLE "VisitAssessment" ADD COLUMN "issuedSealData" TEXT;

UPDATE "VisitAssessment" AS assessment
SET
  "issuedHospitalName" = hospital."name",
  "issuedHospitalCode" = hospital."code",
  "issuedHospitalAddress" = hospital."address",
  "issuedHospitalPhone" = hospital."phone",
  "issuedLogoData" = hospital."logoData",
  "issuedSealData" = hospital."sealData"
FROM "Hospital" AS hospital
WHERE hospital."id" = assessment."hospitalId"
  AND assessment."status" = 'APPROVED'
  AND assessment."issuedHospitalName" IS NULL;

UPDATE "VisitAssessment" AS assessment
SET "approvedBySignatureImage" = signature."imageData"
FROM "UserSignature" AS signature
WHERE signature."id" = assessment."approvedBySignatureId"
  AND assessment."status" = 'APPROVED'
  AND assessment."approvedBySignatureImage" IS NULL;

-- Hospital bills keep the letterhead and patient identity from issue time.
ALTER TABLE "Invoice" ADD COLUMN "issuedHospitalName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "issuedHospitalAddress" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "issuedHospitalPhone" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "issuedPatientName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "issuedPatientMrn" TEXT;

UPDATE "Invoice" AS invoice
SET
  "issuedHospitalName" = hospital."name",
  "issuedHospitalAddress" = hospital."address",
  "issuedHospitalPhone" = hospital."phone",
  "issuedPatientName" = btrim(concat(patient."firstName", ' ', coalesce(patient."lastName", ''))),
  "issuedPatientMrn" = patient."mrn"
FROM "Hospital" AS hospital, "Patient" AS patient
WHERE hospital."id" = invoice."hospitalId"
  AND patient."id" = invoice."patientId"
  AND invoice."issuedHospitalName" IS NULL;
