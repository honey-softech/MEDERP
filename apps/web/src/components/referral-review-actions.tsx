"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

export function ReferralReviewActions({
  referralId,
  capReached,
}: {
  referralId: string;
  capReached: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);

  async function submit(action: "approve" | "reject") {
    setError("");
    setPending(action);
    const response = await fetch(`/api/platform/referrals/${referralId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNote: note }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPending(null);
      setError(data.error ?? "Could not update referral.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Note (optional)
        <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {capReached ? (
        <p className="text-sm text-amber-800">
          Cap reached. Approving records the referral but does not add a free month.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className={primaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void submit("approve")}>
          {pending === "approve" ? "Approving…" : capReached ? "Approve without extra month" : "Approve free month"}
        </button>
        <button className={secondaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void submit("reject")}>
          {pending === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </div>
  );
}
