"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell, buttonClass, fieldClass } from "@/components/auth-shell";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mobileFromQuery = searchParams.get("mobile") ?? "";
  const [mobile, setMobile] = useState(mobileFromQuery);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, otp, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Could not reset password.");
      return;
    }

    router.push("/login?reset=1");
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Enter the OTP sent to your phone, then choose a new password. For now the OTP is 1234."
    >
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
            placeholder="1234"
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          New password
          <input
            className={fieldClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Confirm password
          <input
            className={fieldClass}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Reset password"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link className="font-medium text-teal-700 hover:underline" href="/forgot-password">
          Use a different account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
