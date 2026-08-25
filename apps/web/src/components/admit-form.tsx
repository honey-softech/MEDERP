"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { PatientPicker, type PatientOption } from "@/components/patient-picker";

type Option = { id: string; label: string };
type BedOption = Option & { group?: string };

export function AdmitForm({
  doctors,
  departments,
  beds,
  initialPatient,
  sourceAppointmentId,
  defaultBedId,
  defaultDoctorId,
}: {
  doctors: Option[];
  departments: Option[];
  beds: BedOption[];
  initialPatient?: PatientOption | null;
  sourceAppointmentId?: string | null;
  defaultBedId?: string;
  defaultDoctorId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: form.get("patientId"),
        bedId: form.get("bedId"),
        type: form.get("type"),
        diagnosis: form.get("diagnosis"),
        notes: form.get("notes"),
        attendantName: form.get("attendantName"),
        attendantPhone: form.get("attendantPhone"),
        admittingDoctorId: form.get("admittingDoctorId") || undefined,
        attendingDoctorId: form.get("attendingDoctorId") || undefined,
        departmentId: form.get("departmentId") || undefined,
        sourceAppointmentId: sourceAppointmentId || undefined,
        expectedDischargeAt: form.get("expectedDischargeAt") || undefined,
        advanceAmount: Number(form.get("advanceAmount") ?? 0),
        advanceMethod: form.get("advanceMethod"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not admit the patient.");
      return;
    }
    router.push(`/wards/stays/${data.admission.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid max-w-4xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <PatientPicker initial={initialPatient} registerHref="/patients/new?next=admit" />
      </div>
      <label className="text-sm font-medium text-slate-700">
        Bed / room
        <select className={fieldClass} name="bedId" required defaultValue={defaultBedId ?? ""}>
          <option value="">Select available bed</option>
          {Array.from(
            beds.reduce((map, item) => {
              const key = item.group ?? "Other";
              const list = map.get(key) ?? [];
              list.push(item);
              map.set(key, list);
              return map;
            }, new Map<string, BedOption[]>()),
          ).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {beds.length === 0 ? (
          <span className="mt-1 block text-xs font-normal text-amber-700">
            No available beds. Ask super admin to set capacity under Ward setup, or free a bed from housekeeping.
          </span>
        ) : null}
      </label>
      <label className="text-sm font-medium text-slate-700">
        Admission type
        <select className={fieldClass} name="type" defaultValue="ELECTIVE">
          <option value="ELECTIVE">Elective</option>
          <option value="EMERGENCY">Emergency</option>
          <option value="DAY_CARE">Day care</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Admitting doctor
        <select className={fieldClass} name="admittingDoctorId" defaultValue={defaultDoctorId ?? ""}>
          <option value="">Select doctor</option>
          {doctors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Attending doctor
        <select className={fieldClass} name="attendingDoctorId" defaultValue={defaultDoctorId ?? ""}>
          <option value="">Same as admitting / select</option>
          {doctors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Department
        <select className={fieldClass} name="departmentId">
          <option value="">Use ward department</option>
          {departments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Expected discharge
        <input className={fieldClass} type="date" name="expectedDischargeAt" />
      </label>
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Diagnosis / reason
        <input className={fieldClass} name="diagnosis" required placeholder="Admitting diagnosis" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Attendant name
        <input className={fieldClass} name="attendantName" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Attendant phone
        <input className={fieldClass} name="attendantPhone" />
      </label>
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Notes
        <input className={fieldClass} name="notes" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Admission advance
        <input className={fieldClass} name="advanceAmount" type="number" min="0" step="0.01" defaultValue="0" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Advance method
        <select className={fieldClass} name="advanceMethod" defaultValue="CASH">
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="UPI">UPI</option>
          <option value="INSURANCE">Insurance</option>
        </select>
      </label>
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      <div className="md:col-span-2 flex flex-wrap gap-2">
        <button className={buttonClass} type="submit" disabled={pending || beds.length === 0}>
          {pending ? "Admitting…" : "Admit patient"}
        </button>
        <Link href="/wards" className={secondaryButtonClass}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
