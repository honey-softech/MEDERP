"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/auth-shell";

export function NurseReceptionistForm({
  initial,
}: {
  initial: { nurseAsReceptionist: boolean };
}) {
  const router = useRouter();
  const [nurseAsReceptionist, setNurseAsReceptionist] = useState(initial.nurseAsReceptionist);
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
      body: JSON.stringify({ nurseAsReceptionist }),
    });
    const data = await response.json().catch(() => ({ error: "Could not save nurse reception access." }));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save nurse reception access.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="font-semibold">Nurses as receptionists</h3>
        <p className="mt-1 text-sm text-slate-500">
          Off by default. Turn this on if nurses also cover the front desk. Every nurse then gets reception work:
          register patients, manage the queue, collect bills, and admit. This does not add seats — each nurse still
          counts as one login on your plan. You can still add a dedicated Receptionist if seats remain.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={nurseAsReceptionist}
          onChange={(event) => setNurseAsReceptionist(event.target.checked)}
        />
        <span>
          Nurses can do receptionist work
          <span className="mt-0.5 block text-slate-500">
            Applies to all nurses. Dedicated receptionists keep their own role either way.
          </span>
        </span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-teal-700">Nurse reception access saved.</p> : null}
      <div>
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save nurse reception access"}
        </button>
      </div>
    </form>
  );
}
