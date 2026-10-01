"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { secondaryButtonClass } from "@/components/auth-shell";

const SENT_FLASH_MS = 1500;

export function AppointmentActions({
  id,
  status,
  summaryApproved = false,
  compact = false,
  reminderAlreadySent = false,
  checkoutOnly = false,
}: {
  id: string;
  status: string;
  summaryApproved?: boolean;
  compact?: boolean;
  /** True when a WhatsApp reminder was already queued or delivered for this visit. */
  reminderAlreadySent?: boolean;
  /** Nurse checkout after consult — only the Check out control. */
  checkoutOnly?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [reminderSentOnce, setReminderSentOnce] = useState(reminderAlreadySent);
  const [reminderJustSent, setReminderJustSent] = useState(false);
  const sentFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReminderSentOnce(reminderAlreadySent);
  }, [reminderAlreadySent]);

  useEffect(() => {
    return () => {
      if (sentFlashTimer.current) clearTimeout(sentFlashTimer.current);
    };
  }, []);

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
    if (action === "remind") {
      setReminderSentOnce(true);
      setReminderJustSent(true);
      if (sentFlashTimer.current) clearTimeout(sentFlashTimer.current);
      sentFlashTimer.current = setTimeout(() => {
        setReminderJustSent(false);
        router.refresh();
      }, SENT_FLASH_MS);
      return;
    }
    router.refresh();
  }

  const done = ["CANCELLED", "COMPLETED"].includes(status);
  const canCheckout = (status === "CHECKED_IN" || status === "IN_PROGRESS") && !done;
  const reminderLabel = pending === "remind"
    ? "Sending…"
    : reminderJustSent
      ? "Sent"
      : reminderSentOnce
        ? "Resend"
        : "Send reminder";

  if (checkoutOnly) {
    if (!canCheckout || !summaryApproved) return null;
    return (
      <div className={compact ? "flex flex-wrap gap-2" : "mt-3 flex flex-wrap gap-2"}>
        <button
          className={secondaryButtonClass}
          type="button"
          disabled={Boolean(pending)}
          onClick={() => void run("checkout")}
        >
          {pending === "checkout" ? "…" : "Check out"}
        </button>
        {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "mt-3 flex flex-wrap gap-2"}>
      {status === "SCHEDULED" || status === "NO_SHOW" ? (
        <button className={secondaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void run("checkin")}>
          {pending === "checkin" ? "…" : "Check in"}
        </button>
      ) : null}
      {canCheckout ? (
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
        disabled={Boolean(pending) || reminderJustSent}
        onClick={() => void run("remind", { channels: ["WHATSAPP"] })}
      >
        {reminderLabel}
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
