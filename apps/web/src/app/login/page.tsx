"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell, buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { isValidIndianMobile, mobileValidationError, normalizeMobile } from "@/lib/phone";

const LOGIN_MOBILE_KEY = "mederp.login.mobile";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(LOGIN_MOBILE_KEY);
    if (!saved) return;
    const digits = normalizeMobile(saved);
    if (isValidIndianMobile(digits)) {
      setMobile(digits);
    } else {
      window.localStorage.removeItem(LOGIN_MOBILE_KEY);
    }
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const mobileError = mobileValidationError(mobile, "Mobile number");
    if (mobileError) {
      setError(mobileError);
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setPending(true);
    const normalized = normalizeMobile(mobile);
    window.localStorage.setItem(LOGIN_MOBILE_KEY, normalized);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: normalized, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (data.needsOtp && data.mobile) {
        window.location.replace(`/signup/verify?mobile=${encodeURIComponent(data.mobile)}`);
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Login failed.");
        setPending(false);
        return;
      }

      const next = safeNextPath(searchParams.get("next")) || data.redirectTo || "/";
      window.location.replace(next);
    } catch {
      setError("Could not reach the server. Check that the app is running, then try again.");
      setPending(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Use your registered mobile number. OTP login will be added next.">
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
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            className={fieldClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {searchParams.get("reset") === "1" ? (
          <p className="text-sm text-teal-700">Password updated. Sign in with your new password.</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <Link href="/register-hospital" className={`${secondaryButtonClass} mt-4 w-full`}>
        Register hospital
      </Link>
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link className="font-medium text-teal-700 hover:underline" href="/forgot-password">
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        Staff member?{" "}
        <Link className="font-medium text-teal-700 hover:underline" href="/signup">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
