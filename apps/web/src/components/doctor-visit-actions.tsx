"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

export function DoctorVisitActions({
  id,
  status,
  summaryApproved = false,
}: {
  id: string;
  status: string;
  summaryApproved?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function run(action: string) {
    setError("");
    setPending(action);
    const response = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const raw = await response.text();
    let data: { error?: string } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: "Could not update the visit." };
    }
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not update the visit.");
      return;
    }
    router.refresh();
  }

  const closed = ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(status);
  if (closed) {
    return status === "COMPLETED" ? (
      <p className="mt-3 text-sm font-medium text-teal-800">Visit marked done.</p>
    ) : null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {status !== "IN_PROGRESS" ? (
        <button
          className={secondaryButtonClass}
          type="button"
          disabled={Boolean(pending)}
          onClick={() => void run("start")}
        >
          {pending === "start" ? "Starting…" : "Patient in room / start consult"}
        </button>
      ) : null}
      <button
        className={primaryButtonClass}
        type="button"
        disabled={Boolean(pending) || !summaryApproved}
        onClick={() => void run("complete")}
      >
        {pending === "complete" ? "Saving…" : "Mark visit done"}
      </button>
      {!summaryApproved ? (
        <p className="w-full text-sm text-teal-900">Approve the visit summary and prescription before marking this visit done.</p>
      ) : null}
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
