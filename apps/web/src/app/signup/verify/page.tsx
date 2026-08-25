"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell, buttonClass, fieldClass } from "@/components/auth-shell";

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mobileFromQuery = searchParams.get("mobile") ?? "";
  const [mobile, setMobile] = useState(mobileFromQuery);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
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

  return (
    <AuthShell title="Verify mobile" subtitle="Enter the OTP sent to your phone. For now it is 1234.">
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
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Verifying…" : "Verify"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link className="font-medium text-teal-700 hover:underline" href="/forgot-password">
          Forgot password?
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
