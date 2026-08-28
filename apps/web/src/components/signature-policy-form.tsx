"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/auth-shell";

export function SignaturePolicyForm({
  initial,
  coverage,
}: {
  initial: { requireSignatureForApproval: boolean };
  coverage: { total: number; missing: number; doctorsMissing: number };
}) {
  const router = useRouter();
  const [required, setRequired] = useState(initial.requireSignatureForApproval);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const turningOnWithGaps = required && !initial.requireSignatureForApproval && coverage.doctorsMissing > 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setPending(true);
    const response = await fetch("/api/hospital/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requireSignatureForApproval: required }),
    });
    const data = await response.json().catch(() => ({ error: "Could not save the policy." }));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save the policy.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="font-semibold">Clinical document policy</h3>
        <p className="mt-1 text-sm text-slate-500">
          Signatures are uploaded per user from Hospital users. This controls whether one is mandatory before a doctor
          can approve a visit summary.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={required}
          onChange={(event) => setRequired(event.target.checked)}
        />
        <span>
          Require a signature on file before approving a visit summary
          <span className="mt-0.5 block text-slate-500">
            When off, approval still works and the summary prints the name-only sign-off.
          </span>
        </span>
      </label>

      <p className="text-sm text-slate-500">
        {coverage.missing === 0
          ? `All ${coverage.total} active staff have a signature on file.`
          : `${coverage.missing} of ${coverage.total} active staff have no signature on file` +
            (coverage.doctorsMissing > 0 ? `, including ${coverage.doctorsMissing} doctor(s).` : ".")}
      </p>

      {turningOnWithGaps ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {coverage.doctorsMissing} doctor(s) have no signature yet and will not be able to approve visit summaries
          until you upload one for them.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-teal-700">Policy saved.</p> : null}
      <div>
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save policy"}
        </button>
      </div>
    </form>
  );
}
