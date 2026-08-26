import { randomBytes, randomInt } from "crypto";
import type { AppRole, EmploymentStatus, EmploymentType, Gender, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextCounter, pad, sanitizePhotoData } from "@/lib/front-desk";

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "CONSULTANT",
  "TEMPORARY",
  "INTERN",
];

export const EMPLOYMENT_STATUSES: EmploymentStatus[] = ["ACTIVE", "INACTIVE", "PROBATION", "ON_LEAVE"];

const USER_CODE_PREFIX: Record<string, string> = {
  DOCTOR: "DOC",
  NURSE: "NUR",
  RECEPTIONIST: "REC",
  PHARMACIST: "PHR",
  LAB_TECH: "LAB",
  ACCOUNTANT: "ACC",
  SUPER_ADMIN: "ADM",
};

export function staffRoleFor(role: AppRole): UserRole | null {
  if (role === "SOFTWARE_ADMIN" || role === "SUPER_ADMIN" || role === "HELPDESK") return null;
  return role as UserRole;
}

export function generateStaffPassword() {
  return `Med${randomBytes(4).toString("hex")}@${randomInt(10, 99)}`;
}

export function suggestedUsername(firstName: string, lastName: string) {
  const first = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const last = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = [first, last].filter(Boolean).join(".") || "staff";
  return base.slice(0, 40);
}

export async function nextUserCode(hospitalId: string, role: AppRole) {
  const prefix = USER_CODE_PREFIX[role] ?? "USR";
  const n = await nextCounter(hospitalId, `USER-${prefix}`);
  return `${prefix}-${pad(n, 6)}`;
}

function text(value: unknown) {
  const v = String(value ?? "").trim();
  return v || null;
}

function dateValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function intValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function decimalValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export type EmployeeInput = {
  role: AppRole;
  employeeId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  photoData: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  mobile: string;
  email: string;
  username: string;
  isActive: boolean;
  isVerified: boolean;
  dateJoined: Date | null;
  employmentType: EmploymentType | null;
  preferredLanguage: string | null;
  timezone: string | null;
  departmentId: string | null;
  subDepartment: string | null;
  designation: string | null;
  jobTitle: string | null;
  employmentStatus: EmploymentStatus;
  reportingManager: string | null;
  workLocation: string | null;
  branchName: string | null;
  floor: string | null;
  assignedWard: string | null;
  assignedUnit: string | null;
  opdRoom: string | null;
  procedureRoom: string | null;
  shift: string | null;
  weeklySchedule: string | null;
  joiningDate: Date | null;
  probationEndAt: Date | null;
  yearsExperience: number | null;
  consultationFee: number | null;
  followUpFee: number | null;
  consultationType: string | null;
  teleconsultEnabled: boolean;
  emergencyDutyEnabled: boolean;
  medicalRegNo: string | null;
  regCouncil: string | null;
  regRegion: string | null;
  regIssuedAt: Date | null;
  regExpiresAt: Date | null;
  medicalDegree: string | null;
  university: string | null;
  graduationYear: number | null;
  postgraduate: string | null;
  fellowship: string | null;
  specialization: string | null;
  subSpecialization: string | null;
  areasOfExpertise: string | null;
  languagesSpoken: string | null;
  nursingRegNo: string | null;
  nursingCouncil: string | null;
  nursingQualification: string | null;
  nursingSpecialization: string | null;
  nursingGrade: string | null;
  nurseInCharge: boolean;
  emergencyDutyEligible: boolean;
  pharmacyRegNo: string | null;
  pharmacyCouncil: string | null;
  pharmacyQualification: string | null;
  licenseExpiresAt: Date | null;
  labCertification: string | null;
  labQualification: string | null;
  labLicenseNo: string | null;
  labDepartment: string | null;
  authorizedTestCategories: string | null;
  modalities: string | null;
};

export function parseEmployeeBody(body: Record<string, unknown> | null, role: AppRole): { error: string } | { value: EmployeeInput } {
  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const employeeId = String(body?.employeeId ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const employmentType = body?.employmentType ? (String(body.employmentType) as EmploymentType) : null;
  const gender = body?.gender ? (String(body.gender) as Gender) : null;
  const employmentStatus = (String(body?.employmentStatus ?? "ACTIVE") as EmploymentStatus) || "ACTIVE";
  const staffRole = role !== "SUPER_ADMIN" && role !== "SOFTWARE_ADMIN" && role !== "HELPDESK";

  if (!firstName || !lastName) return { error: "First name and last name are required." };
  if (staffRole && !employeeId) return { error: "Employee ID is required." };
  if (staffRole && (!email || !email.includes("@"))) return { error: "A valid email is required." };
  if (employmentType && !EMPLOYMENT_TYPES.includes(employmentType)) {
    return { error: "Select a valid employment type." };
  }
  if (gender && !["MALE", "FEMALE", "OTHER"].includes(gender)) {
    return { error: "Select a valid gender." };
  }
  if (!EMPLOYMENT_STATUSES.includes(employmentStatus)) {
    return { error: "Select a valid employment status." };
  }

  return {
    value: {
      role,
      employeeId,
      firstName,
      middleName: text(body?.middleName),
      lastName,
      photoData: sanitizePhotoData(body?.photoData),
      dateOfBirth: dateValue(body?.dateOfBirth),
      gender,
      mobile: String(body?.mobile ?? ""),
      email,
      username: String(body?.username ?? "").trim(),
      isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      isVerified: body?.isVerified === undefined ? true : Boolean(body.isVerified),
      dateJoined: dateValue(body?.dateJoined) ?? dateValue(body?.joiningDate) ?? new Date(),
      employmentType,
      preferredLanguage: text(body?.preferredLanguage) ?? "English",
      timezone: text(body?.timezone) ?? "Asia/Kolkata",
      departmentId: text(body?.departmentId),
      subDepartment: text(body?.subDepartment),
      designation: text(body?.designation),
      jobTitle: text(body?.jobTitle),
      employmentStatus,
      reportingManager: text(body?.reportingManager),
      workLocation: text(body?.workLocation),
      branchName: text(body?.branchName),
      floor: text(body?.floor),
      assignedWard: text(body?.assignedWard),
      assignedUnit: text(body?.assignedUnit),
      opdRoom: text(body?.opdRoom),
      procedureRoom: text(body?.procedureRoom),
      shift: text(body?.shift),
      weeklySchedule: text(body?.weeklySchedule),
      joiningDate: dateValue(body?.joiningDate) ?? dateValue(body?.dateJoined),
      probationEndAt: dateValue(body?.probationEndAt),
      yearsExperience: intValue(body?.yearsExperience),
      consultationFee: decimalValue(body?.consultationFee),
      followUpFee: decimalValue(body?.followUpFee),
      consultationType: text(body?.consultationType),
      teleconsultEnabled: Boolean(body?.teleconsultEnabled),
      emergencyDutyEnabled: Boolean(body?.emergencyDutyEnabled),
      medicalRegNo: text(body?.medicalRegNo),
      regCouncil: text(body?.regCouncil),
      regRegion: text(body?.regRegion),
      regIssuedAt: dateValue(body?.regIssuedAt),
      regExpiresAt: dateValue(body?.regExpiresAt),
      medicalDegree: text(body?.medicalDegree),
      university: text(body?.university),
      graduationYear: intValue(body?.graduationYear),
      postgraduate: text(body?.postgraduate),
      fellowship: text(body?.fellowship),
      specialization: text(body?.specialization),
      subSpecialization: text(body?.subSpecialization),
      areasOfExpertise: text(body?.areasOfExpertise),
      languagesSpoken: text(body?.languagesSpoken),
      nursingRegNo: text(body?.nursingRegNo),
      nursingCouncil: text(body?.nursingCouncil),
      nursingQualification: text(body?.nursingQualification),
      nursingSpecialization: text(body?.nursingSpecialization),
      nursingGrade: text(body?.nursingGrade),
      nurseInCharge: Boolean(body?.nurseInCharge),
      emergencyDutyEligible: Boolean(body?.emergencyDutyEligible),
      pharmacyRegNo: text(body?.pharmacyRegNo),
      pharmacyCouncil: text(body?.pharmacyCouncil),
      pharmacyQualification: text(body?.pharmacyQualification),
      licenseExpiresAt: dateValue(body?.licenseExpiresAt),
      labCertification: text(body?.labCertification),
      labQualification: text(body?.labQualification),
      labLicenseNo: text(body?.labLicenseNo),
      labDepartment: text(body?.labDepartment),
      authorizedTestCategories: text(body?.authorizedTestCategories),
      modalities: text(body?.modalities),
    },
  };
}

export async function uniqueUsername(base: string, excludeId?: string) {
  let username = base || "staff";
  for (let i = 0; i < 40; i++) {
    const clash = await prisma.appUser.findFirst({
      where: { username, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return username;
    username = `${base}${i + 2}`;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

export function staffDataFromEmployee(hospitalId: string, input: EmployeeInput): Prisma.StaffUncheckedCreateInput {
  const staffRole = staffRoleFor(input.role);
  return {
    hospitalId,
    email: input.email,
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    role: staffRole ?? "RECEPTIONIST",
    phone: input.mobile,
    departmentId: input.departmentId,
    subDepartment: input.subDepartment,
    designation: input.designation,
    jobTitle: input.jobTitle,
    employmentType: input.employmentType,
    employmentStatus: input.employmentStatus,
    reportingManager: input.reportingManager,
    workLocation: input.workLocation,
    branchName: input.branchName,
    floor: input.floor,
    assignedWard: input.assignedWard,
    assignedUnit: input.assignedUnit,
    opdRoom: input.opdRoom,
    procedureRoom: input.procedureRoom,
    shift: input.shift,
    weeklySchedule: input.weeklySchedule,
    joiningDate: input.joiningDate,
    probationEndAt: input.probationEndAt,
    yearsExperience: input.yearsExperience,
    consultationFee: input.consultationFee,
    followUpFee: input.followUpFee,
    consultationType: input.consultationType,
    teleconsultEnabled: input.teleconsultEnabled,
    emergencyDutyEnabled: input.emergencyDutyEnabled,
    medicalRegNo: input.medicalRegNo,
    regCouncil: input.regCouncil,
    regRegion: input.regRegion,
    regIssuedAt: input.regIssuedAt,
    regExpiresAt: input.regExpiresAt,
    medicalDegree: input.medicalDegree,
    university: input.university,
    graduationYear: input.graduationYear,
    postgraduate: input.postgraduate,
    fellowship: input.fellowship,
    specialization: input.specialization,
    subSpecialization: input.subSpecialization,
    areasOfExpertise: input.areasOfExpertise,
    languagesSpoken: input.languagesSpoken,
    nursingRegNo: input.nursingRegNo,
    nursingCouncil: input.nursingCouncil,
    nursingQualification: input.nursingQualification,
    nursingSpecialization: input.nursingSpecialization,
    nursingGrade: input.nursingGrade,
    nurseInCharge: input.nurseInCharge,
    emergencyDutyEligible: input.emergencyDutyEligible,
    pharmacyRegNo: input.pharmacyRegNo,
    pharmacyCouncil: input.pharmacyCouncil,
    pharmacyQualification: input.pharmacyQualification,
    licenseExpiresAt: input.licenseExpiresAt,
    labCertification: input.labCertification,
    labQualification: input.labQualification,
    labLicenseNo: input.labLicenseNo,
    labDepartment: input.labDepartment,
    authorizedTestCategories: input.authorizedTestCategories,
    modalities: input.modalities,
    isActive: input.isActive && input.employmentStatus !== "INACTIVE",
  };
}

export async function upsertEmployeeStaff(params: {
  hospitalId: string;
  appUserId: string;
  input: EmployeeInput;
}) {
  const staffRole = staffRoleFor(params.input.role);
  if (!staffRole) return null;
  const data = staffDataFromEmployee(params.hospitalId, params.input);
  const existing = await prisma.staff.findUnique({ where: { appUserId: params.appUserId } });
  if (existing) {
    return prisma.staff.update({
      where: { id: existing.id },
      data: { ...data, appUserId: params.appUserId },
    });
  }
  try {
    return await prisma.staff.create({
      data: { ...data, appUserId: params.appUserId },
    });
  } catch {
    return prisma.staff.create({
      data: {
        ...data,
        appUserId: params.appUserId,
        email: `${params.appUserId.slice(-6)}.${params.input.email}`,
      },
    });
  }
}
