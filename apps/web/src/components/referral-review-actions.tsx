"use client";

import { useState } from "react";
import { fieldClass } from "@/components/auth-shell";
import { SoftwareAdminPasswordConfirm } from "@/components/software-admin-password-confirm";

export function ReferralReviewActions({
  referralId,
  capReached,
}: {
  referralId: string;
  capReached: boolean;
}) {
  const [note, setNote] = useState("");

  async function review(action: "approve" | "reject", password: string) {
    const response = await fetch(`/api/platform/referrals/${referralId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNote: note, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) return { ok: false, error: data.error ?? "Could not update referral." };
    return { ok: true };
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
      <div className="flex flex-wrap items-start gap-3">
        <SoftwareAdminPasswordConfirm
          tone="primary"
          openLabel={capReached ? "Approve without extra month" : "Approve free month"}
          confirmLabel="Approve referral"
          pendingLabel="Approving…"
          description="Enter your software admin password to approve this referral."
          onConfirm={(password) => review("approve", password)}
        />
        <SoftwareAdminPasswordConfirm
          openLabel="Reject"
          confirmLabel="Reject referral"
          pendingLabel="Rejecting…"
          description="Enter your software admin password to decline this referral."
          onConfirm={(password) => review("reject", password)}
        />
      </div>
    </div>
  );
}
