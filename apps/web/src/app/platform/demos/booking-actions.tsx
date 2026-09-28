"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactButtonClass } from "@/lib/ui";

export function DemoBookingActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function act(action: "cancel" | "complete") {
    setPending(action);
    setError("");
    const response = await fetch(`/api/platform/demos/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not update the booking.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={compactButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void act("complete")}>
        {pending === "complete" ? "Saving…" : "Complete"}
      </button>
      <button className={compactButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void act("cancel")}>
        {pending === "cancel" ? "Cancelling…" : "Cancel"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
