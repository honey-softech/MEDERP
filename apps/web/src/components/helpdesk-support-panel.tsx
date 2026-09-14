"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { SUPPORT_ACTIONS } from "@/lib/support-action-options";

const ACTIONS = SUPPORT_ACTIONS.filter((action) => action.tier === "support");

export function HelpdeskSupportPanel({
  ticketId,
  targetUserId,
  targetUsername,
  targetMobile,
}: {
  ticketId: string;
  targetUserId?: string | null;
  targetUsername?: string | null;
  targetMobile?: string | null;
}) {
  const router = useRouter();
  const [action, setAction] = useState<(typeof ACTIONS)[number]["id"]>("RESET_PASSWORD");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState(targetMobile ?? "");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (!targetUserId) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h4 className="font-semibold text-amber-950">Support actions</h4>
        <p className="mt-1 text-sm text-amber-900">
          This ticket has no linked user account, so account fixes are unavailable.
        </p>
      </section>
    );
  }

  async function run() {
    setError("");
    setMessage("");
    if (!confirm) {
      setError("Confirm the action before running it.");
      return;
    }
    setPending(true);
    const response = await fetch(`/api/helpdesk/tickets/${ticketId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        targetUserId,
        password: action === "RESET_PASSWORD" ? password : undefined,
        mobile: action === "FIX_MOBILE" ? mobile : undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not run support action.");
      return;
    }
    setMessage(data.threadNote ?? data.summary ?? "Action completed.");
    setConfirm(false);
    setPassword("");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="font-semibold">Support actions</h4>
      <p className="mt-1 text-sm text-slate-500">
        Fix account issues for {targetUsername ?? "the requester"} ({targetMobile ?? "no mobile"}). Every
        action is audited against this ticket.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Action
          <select
            className={fieldClass}
            value={action}
            onChange={(event) => {
              setAction(event.target.value as (typeof ACTIONS)[number]["id"]);
              setConfirm(false);
              setError("");
              setMessage("");
            }}
          >
            {ACTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {action === "RESET_PASSWORD" ? (
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Temporary password
            <input
              className={fieldClass}
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
        ) : null}
        {action === "FIX_MOBILE" ? (
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Correct mobile
            <input
              className={fieldClass}
              inputMode="numeric"
              value={mobile}
              onChange={(event) => setMobile(event.target.value.replace(/[^\d+]/g, ""))}
              required
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
          I confirm this support action for ticket-linked user {targetUsername}
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-teal-700">{message}</p> : null}
      <button className={`${buttonClass} mt-3`} type="button" disabled={pending} onClick={() => void run()}>
        {pending ? "Running…" : "Run support action"}
      </button>
      <button
        className={`${secondaryButtonClass} mt-3 ml-2`}
        type="button"
        disabled={pending}
        onClick={() => {
          setConfirm(false);
          setError("");
          setMessage("");
        }}
      >
        Reset form
      </button>
    </section>
  );
}
