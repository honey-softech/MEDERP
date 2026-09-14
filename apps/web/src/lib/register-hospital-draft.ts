const DRAFT_KEY = "mederp.registerHospital.v3";

export type RegisterDoctorDraft = {
  firstName: string;
  lastName: string;
  medicalRegNo: string;
  specialization: string;
  medicalDegree: string;
  regCouncil: string;
  postgraduate: string;
  consultationFee: string;
  followUpFee: string;
  teleconsultEnabled: boolean;
  emergencyDutyEnabled: boolean;
};

export type RegisterHospitalDraft = {
  name: string;
  code: string;
  address: string;
  phone: string;
  adminUsername: string;
  adminMobile: string;
  adminEmail: string;
  tierId: string;
  termsAccepted: boolean;
  adminAsDoctor: boolean;
  doctorProfile: RegisterDoctorDraft;
};

const emptyDoctor: RegisterDoctorDraft = {
  firstName: "",
  lastName: "",
  medicalRegNo: "",
  specialization: "",
  medicalDegree: "",
  regCouncil: "",
  postgraduate: "",
  consultationFee: "",
  followUpFee: "",
  teleconsultEnabled: false,
  emergencyDutyEnabled: false,
};

const empty: RegisterHospitalDraft = {
  name: "",
  code: "",
  address: "",
  phone: "",
  adminUsername: "",
  adminMobile: "",
  adminEmail: "",
  tierId: "CLINIC",
  termsAccepted: false,
  adminAsDoctor: false,
  doctorProfile: emptyDoctor,
};

export function loadRegisterHospitalDraft(): RegisterHospitalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem(DRAFT_KEY) ??
      window.localStorage.getItem("mederp.registerHospital.v2") ??
      window.localStorage.getItem("mederp.registerHospital.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegisterHospitalDraft> & {
      extraStaffSlots?: number;
      pharmacyEnabled?: boolean;
      labEnabled?: boolean;
    };
    let tierId = parsed.tierId || empty.tierId;
    // Drop obsolete module flags from old drafts — map to seat-based plans only
    if (!parsed.tierId) {
      const seats = 3 + Math.max(0, Math.trunc(Number(parsed.extraStaffSlots ?? 0)));
      if (seats >= 9) tierId = "GROWTH";
      else if (seats >= 6) tierId = "STARTER";
      else tierId = "CLINIC";
    }
    return {
      ...empty,
      ...parsed,
      tierId,
      termsAccepted: Boolean(parsed.termsAccepted),
      adminAsDoctor: Boolean(parsed.adminAsDoctor),
      doctorProfile: { ...emptyDoctor, ...(parsed.doctorProfile ?? {}) },
    };
  } catch {
    return null;
  }
}

export function saveRegisterHospitalDraft(draft: RegisterHospitalDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearRegisterHospitalDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_KEY);
  window.localStorage.removeItem("mederp.registerHospital.v2");
  window.localStorage.removeItem("mederp.registerHospital.v1");
}
