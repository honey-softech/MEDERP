-- Height, weight, and temperature remain required. Other vital signs may be omitted.
ALTER TABLE "VisitVitals" ALTER COLUMN "hasFever" SET DEFAULT false;
ALTER TABLE "VisitVitals" ALTER COLUMN "spo2Percent" DROP NOT NULL;
ALTER TABLE "VisitVitals" ALTER COLUMN "pulseBpm" DROP NOT NULL;
ALTER TABLE "VisitVitals" ALTER COLUMN "respiratoryRate" DROP NOT NULL;
ALTER TABLE "VisitVitals" ALTER COLUMN "bpSystolic" DROP NOT NULL;
ALTER TABLE "VisitVitals" ALTER COLUMN "bpDiastolic" DROP NOT NULL;
