"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass, secondaryButtonClass, fieldClass } from "@/components/auth-shell";

const roles = [
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "DOCTOR", label: "Doctor" },
  { value: "NURSE", label: "Nurse" },
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "LAB_TECH", label: "Lab technician" },
  { value: "ACCOUNTANT", label: "Accountant" },
];

export function JoinRequestActions({
  requestId,
  defaultRole,
}: {
  requestId: string;
  defaultRole: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState(defaultRole);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);

  async function submit(action: "approve" | "reject") {
    setError("");
    setPending(action);
    const response = await fetch(`/api/join-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, role, reviewNote: note }),
    });
    const data = await response.json();
    if (!response.ok) {
      setPending(null);
      setError(data.error ?? "Could not update request.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Assign role
        <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value)}>
          {roles.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Note (optional)
        <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className={primaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void submit("approve")}>
          {pending === "approve" ? "Approving…" : "Approve and add"}
        </button>
        <button className={secondaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void submit("reject")}>
          {pending === "reject" ? "Declining…" : "Decline"}
        </button>
      </div>
    </div>
  );
}
