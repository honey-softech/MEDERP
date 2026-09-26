"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";
import { DoctorProfessionalFields, type DoctorProfessionalValues } from "@/components/doctor-professional-fields";

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

export function AdminDoctorProfileForm({
  departments,
  existingDoctors,
  initialEnabled,
  initialLinkedStaffId,
  initialProfile,
  user,
}: {
  departments: { id: string; label: string }[];
  existingDoctors: ExistingDoctorOption[];
  initialEnabled: boolean;
  initialLinkedStaffId?: string | null;
  initialProfile: ProfileValues | null;
  user: { firstName: string; lastName: string; mobile: string; email: string };
}) {
  const router = useRouter();
  const hasExistingDoctors = existingDoctors.length > 0;
  const defaultMode: "link" | "create" =
    initialLinkedStaffId && hasExistingDoctors
      ? "link"
      : hasExistingDoctors && !initialProfile
        ? "link"
        : "create";

  const [enabled, setEnabled] = useState(initialEnabled);
  const [mode, setMode] = useState<"link" | "create">(defaultMode);
  const [selectedStaffId, setSelectedStaffId] = useState(
    initialLinkedStaffId || existingDoctors.find((row) => row.isActive)?.id || existingDoctors[0]?.id || "",
  );
  const [values, setValues] = useState<ProfileValues>({
    ...emptyProfile,
    firstName: user.firstName,
    lastName: user.lastName,
    ...(initialProfile ?? {}),
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

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
      enabled && mode === "link"
        ? { enabled: true, mode: "link", staffId: selectedStaffId }
        : enabled
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
      enabled
        ? mode === "link"
          ? "Combined into this admin account. Only this admin mobile can sign in. Use the Doctor | Admin switch in the header to change views."
          : "Doctor profile saved. Use the Doctor | Admin switch in the header to change views."
        : "Doctor practice disabled. Admin console stays available.",
    );
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="font-semibold">Admin as doctor</h3>
        <p className="mt-1 text-sm text-slate-500">
          Practice as a doctor on this same login. Sign-in stays this admin mobile ({user.mobile}). Linking an
          existing doctor removes that doctor’s separate login, so admin and doctor are one account.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-1"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span>
          <span className="font-medium">I also practice as a doctor</span>
          <span className="mt-0.5 block text-slate-500">
            Uses one login for hospital admin and clinical practice.
          </span>
        </span>
      </label>

      {enabled ? (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          {hasExistingDoctors ? (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-medium text-slate-800">How do you want to set this up?</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  name="admin-doctor-mode"
                  checked={mode === "link"}
                  onChange={() => setMode("link")}
                />
                <span>
                  <span className="font-medium text-slate-800">Select an existing doctor</span>
                  <span className="mt-0.5 block text-slate-500">
                    Link this admin login to a doctor already on staff.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  name="admin-doctor-mode"
                  checked={mode === "create"}
                  onChange={() => setMode("create")}
                />
                <span>
                  <span className="font-medium text-slate-800">Add new doctor details</span>
                  <span className="mt-0.5 block text-slate-500">
                    Create a fresh doctor profile for this admin account.
                  </span>
                </span>
              </label>
            </fieldset>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No doctors are on staff yet. Fill in new doctor details below.
            </p>
          )}

          {mode === "link" && hasExistingDoctors ? (
            <div className="grid gap-3">
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
                      Currently a separate login ({selectedDoctor.linkedUsername}). Linking removes that account.
                      Only this admin mobile can sign in.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                First name
                <input
                  className={fieldClass}
                  value={values.firstName ?? ""}
                  onChange={(e) => setField("firstName", e.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Last name
                <input
                  className={fieldClass}
                  value={values.lastName ?? ""}
                  onChange={(e) => setField("lastName", e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Department
                <select
                  className={fieldClass}
                  value={values.departmentId ?? ""}
                  onChange={(e) => setField("departmentId", e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.label}
                    </option>
                  ))}
                </select>
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
                requireCore
              />
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-teal-700">{message}</p> : null}
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save doctor profile"}
      </button>
    </form>
  );
}
