"use client";

import { useState, type ComponentProps } from "react";
import { AdminDoctorProfileForm, type ExistingDoctorOption } from "@/components/admin-doctor-profile-form";
import { DoctorAvailabilityEditor } from "@/components/doctor-availability-editor";
import { fieldClass } from "@/lib/ui";

type DoctorOption = { id: string; label: string };

export function DoctorsSection({
  doctors,
  profile,
}: {
  doctors: DoctorOption[];
  profile: {
    departments: { id: string; label: string }[];
    existingDoctors: ExistingDoctorOption[];
    initialEnabled: boolean;
    initialLinkedStaffId: string | null;
    initialProfile: ComponentProps<typeof AdminDoctorProfileForm>["initialProfile"];
    user: { firstName: string; lastName: string; mobile: string; email: string };
  };
}) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const selected = doctors.find((doctor) => doctor.id === doctorId) ?? null;

  return (
    <div className="mt-4 space-y-8">
      <div>
        <h4 className="text-sm font-semibold text-text-primary">Consultation hours</h4>
        <p className="mt-1 text-sm text-text-secondary">
          Pick a doctor, then set their booking windows. Patients only see that doctor&apos;s times.
        </p>
        {doctors.length === 0 ? (
          <p className="mt-3 rounded-lg bg-app-bg px-3 py-3 text-sm text-text-secondary">
            No active doctors yet. Add a doctor under Hospital users first.
          </p>
        ) : (
          <>
            <label className="mt-4 block max-w-sm text-sm font-medium text-text-primary">
              Doctor
              <select
                className={fieldClass}
                value={selected?.id ?? ""}
                onChange={(event) => setDoctorId(event.target.value)}
              >
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.label}
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <div className="mt-4">
                <DoctorAvailabilityEditor key={selected.id} doctorId={selected.id} doctorLabel={selected.label} />
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-border pt-6">
        <h4 className="text-sm font-semibold text-text-primary">Are you, the hospital admin, also a doctor?</h4>
        <p className="mt-1 text-sm text-text-secondary">
          Turn this on if you also see patients. You keep one login for both. Use the Doctor | Admin switch in the
          header to move between the two views. Sign-in stays {profile.user.mobile || "this admin mobile"}.
        </p>
        <div className="mt-4">
          <AdminDoctorProfileForm
            embedded
            departments={profile.departments}
            existingDoctors={profile.existingDoctors}
            initialEnabled={profile.initialEnabled}
            initialLinkedStaffId={profile.initialLinkedStaffId}
            initialProfile={profile.initialProfile}
            user={profile.user}
          />
        </div>
      </div>
    </div>
  );
}
