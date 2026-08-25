"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { secondaryButtonClass } from "@/components/auth-shell";

export function LeaveCancelButton({ leaveId }: { leaveId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onCancel() {
    if (!window.confirm("Cancel this leave request?")) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/leaves/${leaveId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not cancel.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void onCancel()}>
        {pending ? "Cancelling…" : "Cancel request"}
      </button>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
