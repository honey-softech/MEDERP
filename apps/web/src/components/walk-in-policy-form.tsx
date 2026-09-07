"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/auth-shell";

export function WalkInPolicyForm({
  initial,
}: {
  initial: { walkInByDoctor: boolean; walkInByNurse: boolean };
}) {
  const router = useRouter();
  const [walkInByDoctor, setWalkInByDoctor] = useState(initial.walkInByDoctor);
  const [walkInByNurse, setWalkInByNurse] = useState(initial.walkInByNurse);
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
      body: JSON.stringify({ walkInByDoctor, walkInByNurse }),
    });
    const data = await response.json().catch(() => ({ error: "Could not save walk-in access." }));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save walk-in access.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="font-semibold">Walk-in access</h3>
        <p className="mt-1 text-sm text-slate-500">
          Reception and hospital admin can always add walk-ins. Choose whether doctors and nurses can add them too.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={walkInByDoctor}
          onChange={(event) => setWalkInByDoctor(event.target.checked)}
        />
        <span>
          Doctors can add walk-ins
          <span className="mt-0.5 block text-slate-500">A doctor can add a walk-in to their own OPD queue.</span>
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={walkInByNurse}
          onChange={(event) => setWalkInByNurse(event.target.checked)}
        />
        <span>
          Nurses can add walk-ins
          <span className="mt-0.5 block text-slate-500">A nurse can register a walk-in and assign them to a doctor.</span>
        </span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-teal-700">Walk-in access saved.</p> : null}
      <div>
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save walk-in access"}
        </button>
      </div>
    </form>
  );
}
