export {
  BILLING_ROLES,
  CLINICAL_VIEW_ROLES,
  DOCTOR_VISIT_ROLES,
  EXTERNAL_REPORT_UPLOAD_ROLES,
  FRONT_DESK_ROLES,
  LAB_REPORT_VIEW_ROLES,
  LAB_VIEW_ROLES,
  LAB_WORK_ROLES,
  NURSE_VITALS_ROLES,
  PATIENT_REGISTER_ROLES,
  PHARMACY_ROLES,
  PRINT_SUMMARY_ROLES,
  WAIVER_APPROVER_ROLES,
  WALK_IN_BASE_ROLES,
  WALK_IN_ROLES,
  canAddWalkIn,
  canRegisterPatient,
  forbidUnless,
  requireHospitalActor,
  requireHospitalPage,
  walkInRolesFor,
  type HospitalActor,
  type HospitalActorResult,
} from "@/lib/authz/hospital";

export {
  nextCertificateNo,
  nextCounter,
  nextFamilyGroupCode,
  nextInvoiceNo,
  nextMrn,
  nextToken,
  pad,
} from "@/lib/ids";

export {
  ageLabel,
  ageYears,
  doctorName,
  inr,
  patientName,
  physicianLine,
  prettyEnum,
  tokenLabel,
} from "@/lib/display";

export {
  DEFAULT_OPD_FEE,
  amountsMatch,
  consultationFeeForVisit,
  invoiceStatusFromTotals,
  paymentNote,
} from "@/lib/opd/fees";

export {
  digitsOnly,
  ensureFamilyGroup,
  findDuplicatePatients,
  sanitizeLogoData,
  sanitizePhotoData,
  sanitizeSignatureData,
} from "@/lib/opd/patients";

export {
  DEFAULT_DEPARTMENTS,
  addCalendarDays,
  canNurseRecordVitals,
  dayRange,
  doctorIsOnLeave,
  ensureDoctorStaff,
  groupByDoctor,
  isSameCalendarDay,
  listBookableDoctors,
  localDayKey,
  parseLocalDay,
  reminderMessage,
  seedHospitalDepartments,
  staffIdForAppUser,
} from "@/lib/opd/scheduling";
