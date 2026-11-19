"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { compactButtonClass, compactPrimaryButtonClass, fieldClass, textareaClass } from "@/components/auth-shell";

const REASON_MIN = 10;
const REASON_MAX = 500;

export function EditPastRecordButton({
  appointmentId,
  returnVisitId = null,
  autoOpen = false,
  className = compactButtonClass,
  label = "Edit record",
}: {
  appointmentId: string;
  returnVisitId?: string | null;
  autoOpen?: boolean;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, pending]);

  async function unlock() {
    setError("");
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN) {
      setError(`Enter a reason of at least ${REASON_MIN} characters.`);
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setPending(true);
    const response = await fetch(`/api/appointments/${appointmentId}/assessment/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: trimmed, password }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not unlock this record.");
      return;
    }
    const params = new URLSearchParams({ edit: "1" });
    if (returnVisitId && returnVisitId !== appointmentId) params.set("returnVisit", returnVisitId);
    setPassword("");
    setOpen(false);
    router.push(`/appointments/${appointmentId}?${params.toString()}`);
    router.refresh();
  }

  const dialog =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close"
              onClick={() => {
                if (!pending) setOpen(false);
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-past-record-title"
              className="relative z-[111] w-full max-w-md rounded-t-2xl border border-border bg-white p-4 shadow-xl sm:rounded-2xl"
            >
              <h3 id="edit-past-record-title" className="text-base font-semibold text-text-primary">
                Edit this past record
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Enter why you are changing it and your account password. This change is recorded in the audit trail.
              </p>
              <label className="mt-3 block text-xs font-medium text-text-secondary">
                Reason
                <textarea
                  className={textareaClass}
                  rows={3}
                  maxLength={REASON_MAX}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="What needs to be corrected, and why"
                />
              </label>
              <label className="mt-3 block text-xs font-medium text-text-secondary">
                Your password
                <input
                  type="password"
                  autoComplete="current-password"
                  className={fieldClass}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {error ? <p className="mt-2 text-sm text-critical">{error}</p> : null}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" className={compactButtonClass} disabled={pending} onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="button" className={compactPrimaryButtonClass} disabled={pending} onClick={() => void unlock()}>
                  {pending ? "Checking…" : "Unlock for editing"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={className}
        title="Requires a reason and your password"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {label}
      </button>
      {dialog}
    </>
  );
}

export function PastRecordEditBar({
  appointmentId,
  reason,
  expiresAt,
  cancelHref,
}: {
  appointmentId: string;
  reason: string;
  expiresAt: number;
  cancelHref: string;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(() => Math.max(0, expiresAt - Date.now()));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLeft(Math.max(0, expiresAt - Date.now()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  const clock = `${minutes}:${String(seconds).padStart(2, "0")}`;

  async function cancel() {
    setPending(true);
    await fetch(`/api/appointments/${appointmentId}/assessment/unlock`, { method: "DELETE" }).catch(() => null);
    router.push(cancelHref);
    router.refresh();
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1.5 print:hidden">
      <p className="text-xs text-amber-950">
        Editing this past record · {reason}
        {left > 0 ? ` · ${clock} left` : " · confirmation expired, save will be refused until you confirm again"}
      </p>
      <button type="button" className={compactButtonClass} disabled={pending} onClick={() => void cancel()}>
        {pending ? "Closing…" : "Cancel edit"}
      </button>
    </div>
  );
}
