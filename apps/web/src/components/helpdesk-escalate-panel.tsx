"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";

export function HelpdeskEscalatePanel({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (status === "ESCALATED") {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <h4 className="font-semibold text-red-950">Escalated</h4>
        <p className="mt-1 text-sm text-red-900">
          Waiting on a software admin for hospital-level or commercial tools.
        </p>
      </section>
    );
  }

  if (status === "CLOSED" || status === "RESOLVED") {
    return null;
  }

  async function escalate() {
    setError("");
    setMessage("");
    if (!confirm) {
      setError("Confirm escalation before sending it to software admin.");
      return;
    }
    setPending(true);
    const response = await fetch(`/api/helpdesk/tickets/${ticketId}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not escalate ticket.");
      return;
    }
    setMessage("Escalated to software admin.");
    setConfirm(false);
    setReason("");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="font-semibold">Escalate to software admin</h4>
      <p className="mt-1 text-sm text-slate-500">
        Use this when the fix needs hospital code, seats, trial, access, or staff merge — tools only software
        admin can run.
      </p>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Why does this need software admin?
        <textarea
          className={fieldClass}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
        Notify software admins and mark this ticket escalated
      </label>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-teal-700">{message}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={buttonClass} type="button" disabled={pending} onClick={() => void escalate()}>
          {pending ? "Escalating…" : "Escalate"}
        </button>
        <button
          className={secondaryButtonClass}
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirm(false);
            setReason("");
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
