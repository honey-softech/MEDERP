"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";

type Option = { id: string; label: string };

export function LeaveForm({ doctors }: { doctors: Option[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId: form.get("doctorId"),
        staffId: form.get("doctorId"),
        startAt: form.get("startAt"),
        endAt: form.get("endAt"),
        reason: form.get("reason"),
        type: "OTHER",
        record: true,
      }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save leave.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-sm font-medium text-slate-700">
        Doctor
        <select className={fieldClass} name="doctorId" required>
          <option value="">Select</option>
          {doctors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        From
        <input className={fieldClass} type="datetime-local" name="startAt" required />
      </label>
      <label className="text-sm font-medium text-slate-700">
        To
        <input className={fieldClass} type="datetime-local" name="endAt" required />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Reason
        <input className={fieldClass} name="reason" />
      </label>
      <div className="flex items-end">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add leave"}
        </button>
      </div>
      {error ? <p className="sm:col-span-2 lg:col-span-5 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
