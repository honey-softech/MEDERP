"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell, fieldClass, iconButtonClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { DeveloperCredit, ManagedByCredit, PasswordField } from "@/components/auth-branding";
import { isValidIndianMobile, mobileValidationError, normalizeMobile } from "@/lib/phone";
import { signInPasswordError } from "@/lib/password-policy";

const LOGIN_MOBILE_KEY = "mederp.login.mobile";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}

function LoginHelpDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-help-title"
          className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="login-help-title" className="text-lg font-semibold text-slate-900">
                Help
              </h2>
              <p className="mt-1 text-sm text-slate-500">Choose how you want to get support.</p>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              Close
            </button>
          </div>
          <div className="grid gap-2">
            <Link href="/help" className={secondaryButtonClass}>
              Contact support
            </Link>
            <Link href="/help/status" className={secondaryButtonClass}>
              Check status
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
    const blockedPassword = signInPasswordError(password);
    if (blockedPassword) {
      setError(blockedPassword);
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
    <AuthShell
      title="Sign in"
      headerAction={
        <button
          type="button"
          className={iconButtonClass}
          aria-label="Help"
          title="Help"
          onClick={() => setHelpOpen(true)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.4a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.4 1-1.4 1.9" />
            <path d="M12 17h.01" strokeLinecap="round" />
          </svg>
        </button>
      }
    >
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
        <PasswordField value={password} onChange={setPassword} required />
        {searchParams.get("reset") === "1" ? (
          <p className="text-sm text-teal-700">Password updated. Sign in with your new password.</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-3">
          <button className={`${primaryButtonClass} min-w-0 flex-1`} type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <Link href="/register-hospital" className={`${secondaryButtonClass} min-w-0 flex-1`}>
            Register hospital
          </Link>
        </div>
      </form>
      {helpOpen ? <LoginHelpDialog onClose={() => setHelpOpen(false)} /> : null}
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
      <DeveloperCredit />
      <div className="mt-3 text-center">
        <ManagedByCredit />
      </div>
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
