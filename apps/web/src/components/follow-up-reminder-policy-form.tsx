"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/auth-shell";

export function FollowUpReminderPolicyForm({
  initial,
}: {
  initial: { followUpReminderEnabled: boolean; followUpReminderDaysBefore: number };
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.followUpReminderEnabled);
  const [daysBefore, setDaysBefore] = useState(initial.followUpReminderDaysBefore === 2 ? 2 : 1);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setPending(true);
    const response = await fetch("/api/hospital/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        followUpReminderEnabled: enabled,
        followUpReminderDaysBefore: daysBefore,
      }),
    });
    const data = await response.json().catch(() => ({ error: "Could not save follow-up reminders." }));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save follow-up reminders.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="font-semibold">Follow-up reminders</h3>
        <p className="mt-1 text-sm text-slate-500">
          Off by default. Turn this on to WhatsApp patients automatically when a doctor sets a follow-up or reception
          books a follow-up visit. The reminder goes out one or two days before the follow-up date.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span>
          Send follow-up reminders automatically
          <span className="mt-0.5 block text-slate-500">
            Applies to every follow-up at this hospital. Reception can still send a reminder manually from the visit.
          </span>
        </span>
      </label>

      <fieldset className="space-y-2" disabled={!enabled}>
        <legend className="text-sm font-medium text-slate-700">Send the reminder</legend>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="radio"
            className="mt-0.5"
            name="followUpReminderDaysBefore"
            checked={daysBefore === 1}
            onChange={() => setDaysBefore(1)}
          />
          <span>
            1 day before
            <span className="mt-0.5 block text-slate-500">Around 9:00 the calendar day before the follow-up.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="radio"
            className="mt-0.5"
            name="followUpReminderDaysBefore"
            checked={daysBefore === 2}
            onChange={() => setDaysBefore(2)}
          />
          <span>
            2 days before
            <span className="mt-0.5 block text-slate-500">Around 9:00 two calendar days before the follow-up.</span>
          </span>
        </label>
      </fieldset>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-teal-700">Follow-up reminders saved.</p> : null}
      <div>
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save follow-up reminders"}
        </button>
      </div>
    </form>
  );
}
