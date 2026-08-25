"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

export function LeaveReviewActions({
  leaveId,
  canCancel,
}: {
  leaveId: string;
  canCancel?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "approve" | "reject" | "cancel") {
    setPending(true);
    setError("");
    const reviewNote =
      action === "reject" ? window.prompt("Reason for rejection (optional)") ?? "" : "";
    const response = await fetch(`/api/leaves/${leaveId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNote }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update leave.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button className={primaryButtonClass} type="button" disabled={pending} onClick={() => void run("approve")}>
        Approve
      </button>
      <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void run("reject")}>
        Reject
      </button>
      {canCancel ? (
        <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void run("cancel")}>
          Cancel
        </button>
      ) : null}
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
