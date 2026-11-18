"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, primaryButtonClass } from "@/components/auth-shell";
import { DoctorProfessionalFields, type DoctorProfessionalValues } from "@/components/doctor-professional-fields";
import { RadioGroupField } from "@/components/settings/radio-group-field";

type ProfileValues = DoctorProfessionalValues & {
  departmentId?: string;
  opdRoom?: string;
  shift?: string;
  weeklySchedule?: string;
  firstName?: string;
  lastName?: string;
};

export type ExistingDoctorOption = {
  id: string;
  label: string;
  specialization: string;
  medicalRegNo: string;
  department: string;
  isActive: boolean;
  linkedToAdmin: boolean;
  linkedUsername: string | null;
  linkedRole: string | null;
};

const emptyProfile: ProfileValues = {
  medicalRegNo: "",
  specialization: "",
  teleconsultEnabled: false,
  emergencyDutyEnabled: false,
};

type PracticeChoice = "off" | "link" | "create";

const OPTIONAL_KEYS = [
  "lastName",
  "opdRoom",
  "shift",
  "weeklySchedule",
  "regCouncil",
  "regRegion",
  "regIssuedAt",
  "regExpiresAt",
  "medicalDegree",
  "university",
  "graduationYear",
  "postgraduate",
  "fellowship",
  "subSpecialization",
  "yearsExperience",
  "areasOfExpertise",
  "languagesSpoken",
  "consultationType",
  "consultationFee",
  "followUpFee",
] as const satisfies readonly (keyof ProfileValues)[];

function hasOptionalDetails(profile: ProfileValues | null) {
  if (!profile) return false;
  return OPTIONAL_KEYS.some((key) => {
    const value = profile[key];
    return typeof value === "string" && value.trim() !== "";
  });
}

export function AdminDoctorProfileForm({
  departments,
  existingDoctors,
  initialEnabled,
  initialLinkedStaffId,
  initialProfile,
  user,
  embedded = false,
}: {
  departments: { id: string; label: string }[];
  existingDoctors: ExistingDoctorOption[];
  initialEnabled: boolean;
  initialLinkedStaffId?: string | null;
  initialProfile: ProfileValues | null;
  user: { firstName: string; lastName: string; mobile: string; email: string };
  /** Sit inside a settings section instead of drawing a separate card. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const hasExistingDoctors = existingDoctors.length > 0;
  const initialChoice: PracticeChoice = !initialEnabled
    ? "off"
    : initialLinkedStaffId && hasExistingDoctors
      ? "link"
      : "create";

  const [choice, setChoice] = useState<PracticeChoice>(initialChoice);
  const [selectedStaffId, setSelectedStaffId] = useState(
    initialLinkedStaffId || existingDoctors.find((row) => row.isActive)?.id || existingDoctors[0]?.id || "",
  );
  const [values, setValues] = useState<ProfileValues>({
    ...emptyProfile,
    firstName: user.firstName,
    lastName: user.lastName,
    ...(initialProfile ?? {}),
  });
  const [moreDetails, setMoreDetails] = useState(() => hasOptionalDetails(initialProfile));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const choiceOptions: { value: PracticeChoice; label: string }[] = [
    { value: "off", label: "No, I only manage the hospital" },
    ...(hasExistingDoctors ? [{ value: "link" as const, label: "Yes, I am already listed as a doctor" }] : []),
    { value: "create", label: "Yes, add my doctor details" },
  ];

  const selectedDoctor = useMemo(
    () => existingDoctors.find((row) => row.id === selectedStaffId) ?? null,
    [existingDoctors, selectedStaffId],
  );

  function setField(key: keyof ProfileValues, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);

    const payload =
      choice === "link"
        ? { enabled: true, mode: "link", staffId: selectedStaffId }
        : choice === "create"
          ? { enabled: true, mode: "create", ...values }
          : { enabled: false };

    const response = await fetch("/api/hospital/doctor-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save doctor profile.");
      return;
    }
    setMessage(
      choice === "link"
        ? "Combined into this admin account. Only this admin mobile can sign in. Use the Doctor | Admin switch in the header to change views."
        : choice === "create"
          ? "Doctor profile saved. Use the Doctor | Admin switch in the header to change views."
          : "Doctor practice disabled. Admin console stays available.",
    );
    router.refresh();
  }

  return (
    <form
      onSubmit={save}
      className={embedded ? "grid gap-4" : "grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"}
    >
      {embedded ? null : (
        <div>
          <h3 className="font-semibold">Admin as doctor</h3>
          <p className="mt-1 text-sm text-slate-500">
            Practice as a doctor on this same login. Sign-in stays this admin mobile ({user.mobile}). Linking an
            existing doctor removes that doctor’s separate login, so admin and doctor are one account.
          </p>
        </div>
      )}

      <RadioGroupField
        name="admin-doctor-choice"
        ariaLabel="Practise as a doctor"
        value={choice}
        options={choiceOptions}
        onChange={setChoice}
      />

      {choice === "link" && hasExistingDoctors ? (
            <div className="grid gap-3">
              <p className="text-sm text-text-secondary">Pick your entry from the doctor list.</p>
              <label className="block text-sm font-medium text-slate-700">
                Existing doctor
                <select
                  className={fieldClass}
                  value={selectedStaffId}
                  onChange={(event) => setSelectedStaffId(event.target.value)}
                  required
                >
                  <option value="">Select doctor</option>
                  {existingDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.label}
                      {doctor.specialization ? ` · ${doctor.specialization}` : ""}
                      {doctor.linkedToAdmin ? " · currently linked" : ""}
                      {!doctor.isActive ? " · inactive" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selectedDoctor ? (
                <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                  <p className="font-medium">{selectedDoctor.label}</p>
                  <p className="mt-1 text-teal-900">
                    {[selectedDoctor.specialization, selectedDoctor.medicalRegNo, selectedDoctor.department]
                      .filter(Boolean)
                      .join(" · ") || "No specialty details on file"}
                  </p>
                  {selectedDoctor.linkedUsername && !selectedDoctor.linkedToAdmin ? (
                    <p className="mt-2 text-xs text-amber-800">
                      This doctor currently has a separate login ({selectedDoctor.linkedUsername}). Linking removes it, and
                      you will sign in with your admin mobile only.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

      {choice === "create" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            First name <span className="text-red-600">*</span>
            <input
              className={fieldClass}
              value={values.firstName ?? ""}
              onChange={(e) => setField("firstName", e.target.value)}
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Department <span className="text-red-600">*</span>
            <select
              className={fieldClass}
              value={values.departmentId ?? ""}
              onChange={(e) => setField("departmentId", e.target.value)}
              required
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.label}
                </option>
              ))}
            </select>
          </label>
          <DoctorProfessionalFields
            values={values}
            onChange={(key, value) => setField(key, value)}
            requireCore
            hideDutyToggles
            part="core"
          />
          <div className="md:col-span-2">
            <button
              type="button"
              className="text-sm font-medium text-primary"
              aria-expanded={moreDetails}
              onClick={() => setMoreDetails((open) => !open)}
            >
              {moreDetails ? "Hide optional details" : "More details (optional)"}
            </button>
          </div>
          {moreDetails ? (
            <>
              <label className="text-sm font-medium text-slate-700">
                Last name
                <input
                  className={fieldClass}
                  value={values.lastName ?? ""}
                  onChange={(e) => setField("lastName", e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                OPD room
                <input
                  className={fieldClass}
                  value={values.opdRoom ?? ""}
                  onChange={(e) => setField("opdRoom", e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Shift
                <input
                  className={fieldClass}
                  value={values.shift ?? ""}
                  onChange={(e) => setField("shift", e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Weekly working schedule
                <input
                  className={fieldClass}
                  value={values.weeklySchedule ?? ""}
                  onChange={(e) => setField("weeklySchedule", e.target.value)}
                  placeholder="Mon–Sat 9:00–17:00"
                />
              </label>
              <DoctorProfessionalFields
                values={values}
                onChange={(key, value) => setField(key, value)}
                hideDutyToggles
                part="extra"
              />
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-teal-700">{message}</p> : null}
      <div>
        <button className={primaryButtonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save doctor profile"}
        </button>
      </div>
    </form>
  );
}
