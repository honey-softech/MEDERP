const DRAFT_KEY = "mederp.registerHospital.v2";

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
};

export function loadRegisterHospitalDraft(): RegisterHospitalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY) ?? window.localStorage.getItem("mederp.registerHospital.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegisterHospitalDraft> & {
      extraStaffSlots?: number;
      pharmacyEnabled?: boolean;
      labEnabled?: boolean;
    };
    let tierId = parsed.tierId || empty.tierId;
    if (!parsed.tierId && (parsed.pharmacyEnabled || parsed.labEnabled)) {
      tierId = "GROWTH";
    }
    return {
      ...empty,
      ...parsed,
      tierId,
      termsAccepted: Boolean(parsed.termsAccepted),
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
  window.localStorage.removeItem("mederp.registerHospital.v1");
}
