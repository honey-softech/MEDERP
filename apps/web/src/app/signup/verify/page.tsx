"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell, buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";

const RESEND_COOLDOWN_SEC = 60;

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mobileFromQuery = searchParams.get("mobile") ?? "";
  const [mobile, setMobile] = useState(mobileFromQuery);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = window.setTimeout(() => setCooldownSec((sec) => Math.max(0, sec - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSec]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    setPending(true);

    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, otp }),
    });
    const data = await response.json();

    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Verification failed.");
      return;
    }

    router.push("/login");
  }

  async function onResend() {
    if (cooldownSec > 0 || resendPending || !mobile.trim()) return;
    setError("");
    setInfo("");
    setResendPending(true);
    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retry = typeof data.retryAfterSec === "number" ? data.retryAfterSec : 0;
        if (retry > 0) setCooldownSec(retry);
        setError(data.error ?? "Could not resend OTP.");
        return;
      }
      setInfo(data.message ?? "OTP sent on WhatsApp.");
      setCooldownSec(typeof data.cooldownSec === "number" ? data.cooldownSec : RESEND_COOLDOWN_SEC);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setResendPending(false);
    }
  }

  return (
    <AuthShell title="Verify mobile" subtitle="Enter the 6-digit code sent on WhatsApp.">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Mobile number
          <input
            className={fieldClass}
            inputMode="numeric"
            value={mobile}
            onChange={(event) => setMobile(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          OTP
          <input
            className={fieldClass}
            inputMode="numeric"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            placeholder="6-digit code"
            maxLength={6}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {info ? <p className="text-sm text-teal-700">{info}</p> : null}
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Verifying…" : "Verify"}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={resendPending || cooldownSec > 0 || !mobile.trim()}
          onClick={() => void onResend()}
        >
          {resendPending
            ? "Sending…"
            : cooldownSec > 0
              ? `Resend OTP in ${cooldownSec}s`
              : "Resend OTP"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Didn&apos;t get the code? Wait for the timer, then resend.
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        <Link className="font-medium text-teal-700 hover:underline" href="/login">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
      <VerifyOtpForm />
    </Suspense>
  );
}
