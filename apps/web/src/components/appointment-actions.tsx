"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { secondaryButtonClass } from "@/components/auth-shell";

export function AppointmentActions({
  id,
  status,
  compact = false,
}: {
  id: string;
  status: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function run(action: string, extra?: Record<string, unknown>) {
    setError("");
    setPending(action);
    const response = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await response.json();
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }
    router.refresh();
  }

  const done = ["CANCELLED", "COMPLETED"].includes(status);

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "mt-3 flex flex-wrap gap-2"}>
      {status === "SCHEDULED" || status === "NO_SHOW" ? (
        <button className={secondaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void run("checkin")}>
          {pending === "checkin" ? "…" : "Check in"}
        </button>
      ) : null}
      {status === "CHECKED_IN" || status === "IN_PROGRESS" ? (
        <button className={secondaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void run("checkout")}>
          {pending === "checkout" ? "…" : "Check out"}
        </button>
      ) : null}
      {status === "SCHEDULED" ? (
        <button className={secondaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void run("noshow")}>
          No-show
        </button>
      ) : null}
      {!done ? (
        <button className={secondaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void run("cancel")}>
          Cancel
        </button>
      ) : null}
      <button
        className={secondaryButtonClass}
        type="button"
        disabled={Boolean(pending)}
        onClick={() => void run("remind", { channels: ["SMS", "WHATSAPP", "EMAIL"] })}
      >
        {pending === "remind" ? "…" : "Send reminder"}
      </button>
      {!done ? (
        <button
          className={secondaryButtonClass}
          type="button"
          disabled={Boolean(pending)}
          onClick={() => {
            const value = window.prompt("New date and time (YYYY-MM-DDTHH:MM)");
            if (!value) return;
            void run("reschedule", { scheduledAt: value });
          }}
        >
          Reschedule
        </button>
      ) : null}
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
