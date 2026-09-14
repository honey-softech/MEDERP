"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";

type Candidate = { id: string; username: string; mobile: string; role: string };

export function StaffMergePanel({
  survivorId,
  survivorLabel,
  candidates,
}: {
  survivorId: string;
  survivorLabel: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [duplicateId, setDuplicateId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (candidates.length === 0) {
    return null;
  }

  async function merge() {
    setError("");
    setMessage("");
    if (!duplicateId) {
      setError("Select the duplicate account to merge away.");
      return;
    }
    if (!confirm) {
      setError("Confirm the merge before continuing.");
      return;
    }
    setPending(true);
    const response = await fetch(`/api/platform/users/${survivorId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateId }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not merge users.");
      return;
    }
    setMessage(`Merged into ${survivorLabel}. The duplicate account is deactivated.`);
    setConfirm(false);
    setDuplicateId("");
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">Merge duplicate staff account</h3>
      <p className="mt-1 text-sm text-slate-500">
        Keep {survivorLabel}. Reassign helpdesk, leave, notification, and signature records from the duplicate,
        then deactivate it.
      </p>
      <div className="mt-4 grid gap-3">
        <label className="block text-sm font-medium text-slate-700">
          Duplicate to merge away
          <select className={fieldClass} value={duplicateId} onChange={(event) => setDuplicateId(event.target.value)}>
            <option value="">Select user</option>
            {candidates.map((row) => (
              <option key={row.id} value={row.id}>
                {row.username} · {row.mobile} · {row.role.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
          I confirm this merge cannot be undone from the UI
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-teal-700">{message}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={buttonClass} type="button" disabled={pending} onClick={() => void merge()}>
          {pending ? "Merging…" : "Merge into this user"}
        </button>
        <button
          className={secondaryButtonClass}
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirm(false);
            setDuplicateId("");
            setError("");
            setMessage("");
          }}
        >
          Reset
        </button>
      </div>
    </section>
  );
}
