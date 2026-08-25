"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";

const roles = [
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "DOCTOR", label: "Doctor" },
  { value: "NURSE", label: "Nurse" },
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "LAB_TECH", label: "Lab technician" },
  { value: "ACCOUNTANT", label: "Accountant" },
];

type Hospital = { id: string; name: string; code: string; address: string | null; phone: string | null };

export function JoinHospitalForm({
  hospitals,
  defaultRole,
}: {
  hospitals: Hospital[];
  defaultRole: string;
}) {
  const router = useRouter();
  const [hospitalId, setHospitalId] = useState(hospitals[0]?.id ?? "");
  const [role, setRole] = useState(defaultRole);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/join-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hospitalId, role, note }),
    });
    const data = await response.json();
    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Could not send join request.");
      return;
    }
    router.refresh();
    setPending(false);
    setNote("");
  }

  if (hospitals.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No hospitals are listed yet. Ask software admin to add the hospital first.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block text-sm font-medium text-slate-700">
        Listed hospital
        <select className={fieldClass} value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} required>
          {hospitals.map((hospital) => (
            <option key={hospital.id} value={hospital.id}>
              {hospital.name} ({hospital.code})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Role
        <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value)}>
          {roles.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Note for hospital admin (optional)
        <textarea
          className={fieldClass}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Employee ID, department, or who asked you to join"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Sending…" : "Request to join"}
      </button>
    </form>
  );
}

export function CancelJoinButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function cancel() {
    setPending(true);
    await fetch(`/api/join-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    router.refresh();
  }

  return (
    <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void cancel()}>
      {pending ? "Cancelling…" : "Cancel request"}
    </button>
  );
}
