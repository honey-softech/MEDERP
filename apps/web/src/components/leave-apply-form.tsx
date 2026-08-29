"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";

export function LeaveApplyForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.get("type"),
        startAt: form.get("startAt"),
        endAt: form.get("endAt"),
        reason: form.get("reason"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not submit leave.");
      return;
    }
    setMessage("Leave request sent to the hospital super admin.");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">
        Type
        <select className={fieldClass} name="type" defaultValue="CASUAL" required>
          <option value="CASUAL">Casual</option>
          <option value="SICK">Sick</option>
          <option value="EARNED">Earned / privilege</option>
          <option value="EMERGENCY">Emergency</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Reason
        <input className={fieldClass} name="reason" placeholder="Optional" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        From
        <input className={fieldClass} type="date" name="startAt" required />
      </label>
      <label className="text-sm font-medium text-slate-700">
        To
        <input className={fieldClass} type="date" name="endAt" required />
      </label>
      <div className="sm:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Apply for leave"}
        </button>
      </div>
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="sm:col-span-2 text-sm text-teal-700">{message}</p> : null}
    </form>
  );
}
