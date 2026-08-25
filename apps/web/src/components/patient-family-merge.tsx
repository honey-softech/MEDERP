"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";
import { PatientPicker } from "@/components/patient-picker";

export function FamilyLinkForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/patients/${patientId}/family`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relatedPatientId: form.get("patientId"),
        relation: form.get("relation"),
      }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not link family member.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
      <PatientPicker name="patientId" label="Family member" />
      <label className="text-sm font-medium text-slate-700">
        Relation
        <select className={fieldClass} name="relation" defaultValue="CHILD">
          <option value="SPOUSE">Spouse</option>
          <option value="CHILD">Child</option>
          <option value="PARENT">Parent</option>
          <option value="SIBLING">Sibling</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <div className="flex items-end">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Linking…" : "Link"}
        </button>
      </div>
      {error ? <p className="sm:col-span-3 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

export function MergePatientForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Merge the selected record into this patient? This cannot be undone.")) return;
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/patients/${patientId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateId: form.get("patientId") }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not merge patients.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <PatientPicker name="patientId" label="Duplicate record to merge in" />
      <div className="flex items-end">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Merging…" : "Merge into this patient"}
        </button>
      </div>
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
