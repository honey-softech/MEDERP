"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, primaryButtonClass } from "@/components/auth-shell";
import { PatientPicker, type PatientOption } from "@/components/patient-picker";

type Option = { id: string; label: string };

export function AppointmentForm({
  doctors,
  departments,
  defaultQueueType = "SCHEDULED",
  initialPatient,
  defaultDoctorId,
  lockDoctor = false,
  defaultDepartmentId,
  redirectToVisit = false,
}: {
  doctors: Option[];
  departments: Option[];
  defaultQueueType?: "SCHEDULED" | "WALK_IN";
  initialPatient?: PatientOption | null;
  defaultDoctorId?: string;
  lockDoctor?: boolean;
  defaultDepartmentId?: string;
  redirectToVisit?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [doctorId, setDoctorId] = useState(defaultDoctorId ?? "");
  const [onLeaveIds, setOnLeaveIds] = useState<string[]>([]);
  const walkInDefault = defaultQueueType === "WALK_IN";
  const lockedDoctor = lockDoctor ? doctors.find((row) => row.id === defaultDoctorId) : null;
  const selectedOnLeave = Boolean(doctorId && onLeaveIds.includes(doctorId));

  useEffect(() => {
    const at = scheduledAt || (walkInDefault ? new Date().toISOString() : "");
    if (!at) {
      setOnLeaveIds([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void fetch(`/api/appointments?leaveAt=${encodeURIComponent(at)}`)
        .then((response) => response.json())
        .then((data) => {
          setOnLeaveIds(Array.isArray(data.onLeaveDoctorIds) ? data.onLeaveDoctorIds : []);
        })
        .catch(() => setOnLeaveIds([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [scheduledAt, walkInDefault]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (selectedOnLeave) {
      setError("This doctor is on leave that day. Choose another doctor or another date.");
      return;
    }
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        checkInNow: payload.checkInNow === "on" || payload.queueType === "WALK_IN",
      }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not book appointment.");
      return;
    }
    const appointmentId = data.appointment?.id as string | undefined;
    if (payload.queueType === "WALK_IN" && appointmentId && !redirectToVisit) {
      router.push(`/billing/collect/${appointmentId}`);
    } else {
      router.push(appointmentId ? `/appointments/${appointmentId}` : "/appointments");
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid max-w-4xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            Search an existing patient, or register a new one and continue booking.
          </p>
          <Link
            href={walkInDefault ? "/patients/new?next=walkin" : "/patients/new?next=appointment"}
            className={primaryButtonClass}
          >
            Register patient
          </Link>
        </div>
        <PatientPicker
          initial={initialPatient}
          registerHref={walkInDefault ? "/patients/new?next=walkin" : "/patients/new?next=appointment"}
        />
      </div>
      {lockDoctor && defaultDoctorId ? (
        <label className="text-sm font-medium text-slate-700">
          Doctor
          <input type="hidden" name="doctorId" value={defaultDoctorId} />
          <input className={`${fieldClass} bg-slate-50`} value={lockedDoctor?.label ?? "You"} readOnly />
          {selectedOnLeave ? (
            <span className="mt-1 block text-xs font-normal text-amber-700">You are on leave this day.</span>
          ) : null}
        </label>
      ) : (
        <label className="text-sm font-medium text-slate-700">
          Doctor
          <select
            className={fieldClass}
            name="doctorId"
            required
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
          >
            <option value="">Select doctor</option>
            {doctors.map((item) => (
              <option key={item.id} value={item.id} disabled={onLeaveIds.includes(item.id)}>
                {item.label}
                {onLeaveIds.includes(item.id) ? " (on leave)" : ""}
              </option>
            ))}
          </select>
          {doctors.length === 0 ? (
            <span className="mt-1 block text-xs font-normal text-amber-700">
              No doctor users in this hospital yet. Add one under Hospital users with the Doctor role.
            </span>
          ) : null}
        </label>
      )}
      <label className="text-sm font-medium text-slate-700">
        Department
        <select className={fieldClass} name="departmentId" required defaultValue={defaultDepartmentId ?? ""}>
          <option value="">Select department</option>
          {departments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Date and time
        <input
          className={fieldClass}
          type="datetime-local"
          name="scheduledAt"
          required={!walkInDefault}
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
        />
      </label>
      {walkInDefault && lockDoctor ? (
        <input type="hidden" name="queueType" value="WALK_IN" />
      ) : (
        <label className="text-sm font-medium text-slate-700">
          Queue type
          <select className={fieldClass} name="queueType" defaultValue={defaultQueueType}>
            <option value="SCHEDULED">Scheduled</option>
            <option value="WALK_IN">Walk-in</option>
          </select>
        </label>
      )}
      <label className="text-sm font-medium text-slate-700">
        Visit type
        <select className={fieldClass} name="visitType" defaultValue="NEW">
          <option value="NEW">New</option>
          <option value="FOLLOW_UP">Follow-up</option>
          <option value="EMERGENCY">Emergency</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Referral
        <select className={fieldClass} name="referralSource" defaultValue="SELF">
          <option value="SELF">Self</option>
          <option value="DOCTOR">Doctor referred</option>
          <option value="INSURANCE">Insurance</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Referred by
        <input className={fieldClass} name="referredBy" placeholder="Doctor or insurer name" />
      </label>
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Reason / notes
        <input className={fieldClass} name="reason" />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" name="checkInNow" defaultChecked={walkInDefault} />
        Check in now and issue token
      </label>
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending || selectedOnLeave}>
          {pending ? "Saving…" : walkInDefault ? "Add walk-in" : "Book appointment"}
        </button>
      </div>
    </form>
  );
}
