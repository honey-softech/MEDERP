"use client";

import { useEffect, useRef, useState } from "react";
import { fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { mobileValidationError, normalizeMobile } from "@/lib/phone";

export function AdminWhatsappOtp({
  mobile,
  adminIsDoctor,
  proof,
  onProof,
}: {
  mobile: string;
  /** True when this login is also the doctor. Null when the form has no doctor choice. */
  adminIsDoctor: boolean | null;
  proof: string;
  onProof: (proof: string) => void;
}) {
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const mobileKey = normalizeMobile(mobile);
  const previousMobile = useRef(mobileKey);

  useEffect(() => {
    if (previousMobile.current === mobileKey) return;
    previousMobile.current = mobileKey;
    setSent(false);
    setOtp("");
    setError("");
    setNotice("");
    onProof("");
  }, [mobileKey, onProof]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const handle = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(handle);
  }, [cooldown]);

  async function sendOtp() {
    setError("");
    setNotice("");
    const mobileError = mobileValidationError(mobile, "Super admin mobile");
    if (mobileError) {
      setError(mobileError);
      return;
    }
    setPending("send");
    const response = await fetch("/api/public/register-hospital/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: mobileKey }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string; retryAfterSec?: number };
    setPending(null);
    if (!response.ok) {
      if (response.status === 429 && data.retryAfterSec) setCooldown(data.retryAfterSec);
      setError(data.error ?? "Could not send the OTP on WhatsApp.");
      return;
    }
    setSent(true);
    setCooldown(60);
    setNotice(data.message ?? "OTP sent on WhatsApp.");
  }

  async function verifyOtp() {
    setError("");
    setNotice("");
    setPending("verify");
    const response = await fetch("/api/public/register-hospital/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: mobileKey, otp }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; proof?: string; message?: string };
    setPending(null);
    if (!response.ok || !data.proof) {
      setError(data.error ?? "Could not verify the OTP.");
      return;
    }
    onProof(data.proof);
    setNotice(data.message ?? "Admin WhatsApp number verified.");
  }

  const differentFromDoctor = adminIsDoctor === false;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-normal leading-5 text-slate-600">
        Use a WhatsApp number as the super admin number. We send a one-time code on WhatsApp, and the hospital
        cannot be registered until that number is verified.
        {differentFromDoctor
          ? " The admin is different from the doctor, so verify this admin number — not a doctor’s personal number."
          : adminIsDoctor
            ? " This same WhatsApp number is used for the admin and the doctor."
            : " If the admin is not the doctor, enter the admin’s WhatsApp number here, not the doctor’s."}
      </p>
      {proof ? (
        <p className="mt-2 text-sm font-medium text-teal-800">WhatsApp number verified. You can register this hospital.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <button
            type="button"
            className={`${secondaryButtonClass} sm:w-auto`}
            disabled={pending !== null || cooldown > 0}
            onClick={() => void sendOtp()}
          >
            {pending === "send" ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : sent ? "Resend OTP" : "Send OTP on WhatsApp"}
          </button>
          {sent ? (
            <>
              <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">
                OTP
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                />
              </label>
              <button
                type="button"
                className={`${secondaryButtonClass} sm:w-auto`}
                disabled={pending !== null || otp.length !== 6}
                onClick={() => void verifyOtp()}
              >
                {pending === "verify" ? "Verifying…" : "Verify number"}
              </button>
            </>
          ) : null}
        </div>
      )}
      {notice && !proof ? <p className="mt-2 text-xs text-teal-800">{notice}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
