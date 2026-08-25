"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

export function BedStatusButton({
  bedId,
  action,
  label,
}: {
  bedId: string;
  action: "ready" | "maintenance" | "block" | "unblock";
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setError("");
    setPending(true);
    const response = await fetch(`/api/beds/${bedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update the bed.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={action === "ready" ? primaryButtonClass : secondaryButtonClass}
        disabled={pending}
        onClick={() => void run()}
      >
        {pending ? "Saving…" : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
