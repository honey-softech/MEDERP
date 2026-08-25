"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, primaryButtonClass } from "@/components/auth-shell";

export function FollowUpForm({
  appointmentId,
  initial,
}: {
  appointmentId: string;
  initial?: string | Date | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(() => {
    if (!initial) return "";
    const value = initial instanceof Date ? initial : new Date(initial);
    if (Number.isNaN(value.getTime())) return String(initial).slice(0, 10);
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 10);
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch(`/api/appointments/${appointmentId}/assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "followup", followUpAt: date }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save follow-up.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="font-semibold">Follow-up</h4>
      <p className="mt-1 text-sm text-slate-500">Set the next review date for this patient after the consult.</p>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Follow-up date
        <input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button className={`${primaryButtonClass} mt-3`} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save follow-up"}
      </button>
    </form>
  );
}
