-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'CONSULTANT', 'TEMPORARY', 'INTERN');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROBATION', 'ON_LEAVE');

-- AlterTable AppUser
ALTER TABLE "AppUser" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppUser" ADD COLUMN "userCode" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "firstName" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "middleName" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "lastName" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "photoData" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "AppUser" ADD COLUMN "gender" "Gender";
ALTER TABLE "AppUser" ADD COLUMN "email" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "dateJoined" TIMESTAMP(3);
ALTER TABLE "AppUser" ADD COLUMN "employmentType" "EmploymentType";
ALTER TABLE "AppUser" ADD COLUMN "preferredLanguage" TEXT DEFAULT 'English';
ALTER TABLE "AppUser" ADD COLUMN "timezone" TEXT DEFAULT 'Asia/Kolkata';

CREATE UNIQUE INDEX "AppUser_hospitalId_userCode_key" ON "AppUser"("hospitalId", "userCode");
CREATE UNIQUE INDEX "AppUser_hospitalId_employeeId_key" ON "AppUser"("hospitalId", "employeeId");

-- AlterTable Staff
ALTER TABLE "Staff" ADD COLUMN "middleName" TEXT;
ALTER TABLE "Staff" ADD COLUMN "subDepartment" TEXT;
ALTER TABLE "Staff" ADD COLUMN "designation" TEXT;
ALTER TABLE "Staff" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "Staff" ADD COLUMN "employmentType" "EmploymentType";
ALTER TABLE "Staff" ADD COLUMN "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Staff" ADD COLUMN "reportingManager" TEXT;
ALTER TABLE "Staff" ADD COLUMN "workLocation" TEXT;
ALTER TABLE "Staff" ADD COLUMN "branchName" TEXT;
ALTER TABLE "Staff" ADD COLUMN "floor" TEXT;
ALTER TABLE "Staff" ADD COLUMN "assignedWard" TEXT;
ALTER TABLE "Staff" ADD COLUMN "assignedUnit" TEXT;
ALTER TABLE "Staff" ADD COLUMN "opdRoom" TEXT;
ALTER TABLE "Staff" ADD COLUMN "procedureRoom" TEXT;
ALTER TABLE "Staff" ADD COLUMN "shift" TEXT;
ALTER TABLE "Staff" ADD COLUMN "weeklySchedule" TEXT;
ALTER TABLE "Staff" ADD COLUMN "joiningDate" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN "probationEndAt" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN "yearsExperience" INTEGER;
ALTER TABLE "Staff" ADD COLUMN "followUpFee" DECIMAL(12,2);
ALTER TABLE "Staff" ADD COLUMN "consultationType" TEXT;
ALTER TABLE "Staff" ADD COLUMN "teleconsultEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Staff" ADD COLUMN "emergencyDutyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Staff" ADD COLUMN "medicalRegNo" TEXT;
ALTER TABLE "Staff" ADD COLUMN "regCouncil" TEXT;
ALTER TABLE "Staff" ADD COLUMN "regRegion" TEXT;
ALTER TABLE "Staff" ADD COLUMN "regIssuedAt" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN "regExpiresAt" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN "medicalDegree" TEXT;
ALTER TABLE "Staff" ADD COLUMN "university" TEXT;
ALTER TABLE "Staff" ADD COLUMN "graduationYear" INTEGER;
ALTER TABLE "Staff" ADD COLUMN "postgraduate" TEXT;
ALTER TABLE "Staff" ADD COLUMN "fellowship" TEXT;
ALTER TABLE "Staff" ADD COLUMN "specialization" TEXT;
ALTER TABLE "Staff" ADD COLUMN "subSpecialization" TEXT;
ALTER TABLE "Staff" ADD COLUMN "areasOfExpertise" TEXT;
ALTER TABLE "Staff" ADD COLUMN "languagesSpoken" TEXT;
ALTER TABLE "Staff" ADD COLUMN "nursingRegNo" TEXT;
ALTER TABLE "Staff" ADD COLUMN "nursingCouncil" TEXT;
ALTER TABLE "Staff" ADD COLUMN "nursingQualification" TEXT;
ALTER TABLE "Staff" ADD COLUMN "nursingSpecialization" TEXT;
ALTER TABLE "Staff" ADD COLUMN "nursingGrade" TEXT;
ALTER TABLE "Staff" ADD COLUMN "nurseInCharge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Staff" ADD COLUMN "emergencyDutyEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Staff" ADD COLUMN "pharmacyRegNo" TEXT;
ALTER TABLE "Staff" ADD COLUMN "pharmacyCouncil" TEXT;
ALTER TABLE "Staff" ADD COLUMN "pharmacyQualification" TEXT;
ALTER TABLE "Staff" ADD COLUMN "licenseExpiresAt" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN "labCertification" TEXT;
ALTER TABLE "Staff" ADD COLUMN "labQualification" TEXT;
ALTER TABLE "Staff" ADD COLUMN "labLicenseNo" TEXT;
ALTER TABLE "Staff" ADD COLUMN "labDepartment" TEXT;
ALTER TABLE "Staff" ADD COLUMN "authorizedTestCategories" TEXT;
ALTER TABLE "Staff" ADD COLUMN "modalities" TEXT;
