"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cardClass, fieldClass, secondaryButtonClass } from "@/lib/ui";

const dangerButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg bg-critical px-4 text-sm font-medium text-white hover:bg-critical/90 disabled:opacity-60";

export function OtpDangerAction({
  title,
  description,
  sendUrl,
  confirmUrl,
  confirmLabel,
  disabled = false,
  disabledReason,
  open,
  onOpenChange,
  grouped = false,
}: {
  title: string;
  description: string;
  sendUrl: string;
  confirmUrl: string;
  confirmLabel: string;
  disabled?: boolean;
  disabledReason?: string;
  /** When set, the parent decides whether the explanation is visible. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Sit inside a shared card instead of drawing a separate one. */
  grouped?: boolean;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = window.setTimeout(() => setCooldownSec((sec) => Math.max(0, sec - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSec]);

  function closePanel() {
    setError("");
    setInfo("");
    setOpen(false);
  }

  async function onSend() {
    if (disabled || sending || cooldownSec > 0) return;
    setError("");
    setInfo("");
    setSending(true);
    try {
      const response = await fetch(sendUrl, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retry = typeof data.retryAfterSec === "number" ? data.retryAfterSec : 0;
        if (retry > 0) setCooldownSec(retry);
        setError(data.error ?? "Could not send OTP.");
        return;
      }
      setSent(true);
      setInfo(data.message ?? "OTP sent on WhatsApp.");
      setCooldownSec(typeof data.cooldownSec === "number" ? data.cooldownSec : 60);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function onConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || pending) return;
    setError("");
    setInfo("");
    setPending(true);
    try {
      const response = await fetch(confirmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not confirm this action.");
        setPending(false);
        return;
      }
      router.push(typeof data.redirectTo === "string" ? data.redirectTo : "/login");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
      setPending(false);
    }
  }

  const shell = (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-app-bg ${
          isOpen ? "bg-app-bg" : ""
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isOpen ? "bg-critical-bg text-critical" : "bg-primary-light text-primary-dark"
          }`}
        >
          <ActionIcon title={title} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">{title}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-text-disabled transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="rounded-lg bg-critical-bg px-3 py-3 text-sm leading-relaxed text-text-primary">{description}</div>
          {disabled ? (
            <p className="rounded-lg bg-warning-bg px-3 py-3 text-sm text-text-primary">{disabledReason}</p>
          ) : (
            <form onSubmit={onConfirm} className="grid max-w-md gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-disabled">1. WhatsApp code</p>
                <button
                  type="button"
                  className={`${secondaryButtonClass} mt-2`}
                  disabled={sending || cooldownSec > 0}
                  onClick={() => void onSend()}
                >
                  {sending ? "Sending…" : cooldownSec > 0 ? `Resend OTP in ${cooldownSec}s` : sent ? "Resend OTP" : "Send WhatsApp OTP"}
                </button>
              </div>
              <label className="block text-sm font-medium text-text-primary">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-disabled">2. Enter OTP</span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  maxLength={6}
                  required
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={dangerButtonClass} type="submit" disabled={pending || otp.length !== 6}>
                  {pending ? "Confirming…" : confirmLabel}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={closePanel}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {error ? <p className="text-sm text-critical">{error}</p> : null}
          {info ? <p className="text-sm text-secondary">{info}</p> : null}
        </div>
      ) : null}
    </div>
  );

  if (grouped) return shell;
  return <section className={`${cardClass} mt-8 overflow-hidden`}>{shell}</section>;
}

function ActionIcon({ title }: { title: string }) {
  const className = "h-4 w-4";
  const stroke = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const };
  if (title.toLowerCase().includes("hospital") && title.toLowerCase().includes("leave")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M10 7V4H5v16h6" />
        <path d="M14 12h7M17 9l4 3-4 3" />
      </svg>
    );
  }
  if (title.toLowerCase().includes("hospital")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M4 20V8l8-4 8 4v12" />
        <path d="M9 20v-6h6v6M12 9v4M10 11h4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c.8-3 2.8-4.5 7-4.5S18.2 16 19 19" />
      <path d="M16 16.5 19 19.5" />
    </svg>
  );
}
