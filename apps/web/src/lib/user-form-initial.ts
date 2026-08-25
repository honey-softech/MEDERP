function dateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function money(value: { toString(): string } | number | null | undefined) {
  if (value == null) return "";
  return String(Number(value));
}

export function userFormInitial(user: {
  id: string;
  userCode?: string | null;
  role: string;
  employeeId?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  photoData?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  mobile: string;
  email?: string | null;
  username: string;
  isActive?: boolean;
  isVerified: boolean;
  dateJoined?: Date | null;
  employmentType?: string | null;
  preferredLanguage?: string | null;
  timezone?: string | null;
  staffProfile?: {
    departmentId?: string | null;
    subDepartment?: string | null;
    designation?: string | null;
    jobTitle?: string | null;
    employmentStatus?: string | null;
    reportingManager?: string | null;
    workLocation?: string | null;
    branchName?: string | null;
    floor?: string | null;
    assignedWard?: string | null;
    assignedUnit?: string | null;
    opdRoom?: string | null;
    procedureRoom?: string | null;
    shift?: string | null;
    weeklySchedule?: string | null;
    joiningDate?: Date | null;
    probationEndAt?: Date | null;
    yearsExperience?: number | null;
    consultationFee?: { toString(): string } | number | null;
    followUpFee?: { toString(): string } | number | null;
    consultationType?: string | null;
    teleconsultEnabled?: boolean;
    emergencyDutyEnabled?: boolean;
    medicalRegNo?: string | null;
    regCouncil?: string | null;
    regRegion?: string | null;
    regIssuedAt?: Date | null;
    regExpiresAt?: Date | null;
    medicalDegree?: string | null;
    university?: string | null;
    graduationYear?: number | null;
    postgraduate?: string | null;
    fellowship?: string | null;
    specialization?: string | null;
    subSpecialization?: string | null;
    areasOfExpertise?: string | null;
    languagesSpoken?: string | null;
    nursingRegNo?: string | null;
    nursingCouncil?: string | null;
    nursingQualification?: string | null;
    nursingSpecialization?: string | null;
    nursingGrade?: string | null;
    nurseInCharge?: boolean;
    emergencyDutyEligible?: boolean;
    pharmacyRegNo?: string | null;
    pharmacyCouncil?: string | null;
    pharmacyQualification?: string | null;
    licenseExpiresAt?: Date | null;
    labCertification?: string | null;
    labQualification?: string | null;
    labLicenseNo?: string | null;
    labDepartment?: string | null;
    authorizedTestCategories?: string | null;
    modalities?: string | null;
  } | null;
}) {
  const staff = user.staffProfile;
  return {
    id: user.id,
    userCode: user.userCode,
    role: user.role,
    employeeId: user.employeeId,
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    photoData: user.photoData,
    dateOfBirth: dateInput(user.dateOfBirth),
    gender: user.gender,
    mobile: user.mobile,
    email: user.email,
    username: user.username,
    isActive: user.isActive !== false,
    isVerified: user.isVerified,
    dateJoined: dateInput(user.dateJoined),
    employmentType: user.employmentType,
    preferredLanguage: user.preferredLanguage,
    timezone: user.timezone,
    departmentId: staff?.departmentId,
    subDepartment: staff?.subDepartment,
    designation: staff?.designation,
    jobTitle: staff?.jobTitle,
    employmentStatus: staff?.employmentStatus,
    reportingManager: staff?.reportingManager,
    workLocation: staff?.workLocation,
    branchName: staff?.branchName,
    floor: staff?.floor,
    assignedWard: staff?.assignedWard,
    assignedUnit: staff?.assignedUnit,
    opdRoom: staff?.opdRoom,
    procedureRoom: staff?.procedureRoom,
    shift: staff?.shift,
    weeklySchedule: staff?.weeklySchedule,
    joiningDate: dateInput(staff?.joiningDate),
    probationEndAt: dateInput(staff?.probationEndAt),
    yearsExperience: staff?.yearsExperience != null ? String(staff.yearsExperience) : "",
    consultationFee: money(staff?.consultationFee),
    followUpFee: money(staff?.followUpFee),
    consultationType: staff?.consultationType,
    teleconsultEnabled: staff?.teleconsultEnabled,
    emergencyDutyEnabled: staff?.emergencyDutyEnabled,
    medicalRegNo: staff?.medicalRegNo,
    regCouncil: staff?.regCouncil,
    regRegion: staff?.regRegion,
    regIssuedAt: dateInput(staff?.regIssuedAt),
    regExpiresAt: dateInput(staff?.regExpiresAt),
    medicalDegree: staff?.medicalDegree,
    university: staff?.university,
    graduationYear: staff?.graduationYear != null ? String(staff.graduationYear) : "",
    postgraduate: staff?.postgraduate,
    fellowship: staff?.fellowship,
    specialization: staff?.specialization,
    subSpecialization: staff?.subSpecialization,
    areasOfExpertise: staff?.areasOfExpertise,
    languagesSpoken: staff?.languagesSpoken,
    nursingRegNo: staff?.nursingRegNo,
    nursingCouncil: staff?.nursingCouncil,
    nursingQualification: staff?.nursingQualification,
    nursingSpecialization: staff?.nursingSpecialization,
    nursingGrade: staff?.nursingGrade,
    nurseInCharge: staff?.nurseInCharge,
    emergencyDutyEligible: staff?.emergencyDutyEligible,
    pharmacyRegNo: staff?.pharmacyRegNo,
    pharmacyCouncil: staff?.pharmacyCouncil,
    pharmacyQualification: staff?.pharmacyQualification,
    licenseExpiresAt: dateInput(staff?.licenseExpiresAt),
    labCertification: staff?.labCertification,
    labQualification: staff?.labQualification,
    labLicenseNo: staff?.labLicenseNo,
    labDepartment: staff?.labDepartment,
    authorizedTestCategories: staff?.authorizedTestCategories,
    modalities: staff?.modalities,
  };
}
