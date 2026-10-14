"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, secondaryButtonClass } from "@/lib/ui";

const dangerButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60";

export function OtpDangerAction({
  title,
  description,
  sendUrl,
  confirmUrl,
  confirmLabel,
  disabled = false,
  disabledReason,
}: {
  title: string;
  description: string;
  sendUrl: string;
  confirmUrl: string;
  confirmLabel: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
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

  return (
    <section className="mt-8 rounded-2xl border border-red-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {disabled ? <p className="mt-3 text-sm text-amber-800">{disabledReason}</p> : null}
      {disabled ? null : (
        <form onSubmit={onConfirm} className="mt-4 grid max-w-md gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} disabled={sending || cooldownSec > 0} onClick={() => void onSend()}>
              {sending ? "Sending…" : cooldownSec > 0 ? `Resend OTP in ${cooldownSec}s` : sent ? "Resend OTP" : "Send WhatsApp OTP"}
            </button>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            OTP
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
          <button className={dangerButtonClass} type="submit" disabled={pending || otp.length !== 6}>
            {pending ? "Confirming…" : confirmLabel}
          </button>
        </form>
      )}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {info ? <p className="mt-3 text-sm text-teal-700">{info}</p> : null}
    </section>
  );
}
