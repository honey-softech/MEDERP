"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, buttonClass, fieldClass } from "@/components/auth-shell";
import { mobileValidationError } from "@/lib/phone";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const mobileError = mobileValidationError(mobile, "Mobile number");
    if (mobileError) {
      setError(mobileError);
      return;
    }
    setPending(true);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const data = await response.json();

    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Could not start password reset.");
      return;
    }

    router.push(`/forgot-password/reset?mobile=${encodeURIComponent(data.mobile)}`);
  }

  return (
    <AuthShell title="Reset password" subtitle="Enter your registered mobile number. Until SMS is connected, the OTP is 123456 for every account.">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Mobile number
          <input
            className={fieldClass}
            inputMode="numeric"
            autoComplete="tel"
            maxLength={13}
            value={mobile}
            onChange={(event) => setMobile(event.target.value.replace(/[^\d+]/g, ""))}
            placeholder="10-digit mobile"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Sending OTP…" : "Send OTP"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Remembered it?{" "}
        <Link className="font-medium text-teal-700 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
