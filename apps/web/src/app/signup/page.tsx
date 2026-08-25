"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, buttonClass, fieldClass } from "@/components/auth-shell";
import { mobileValidationError } from "@/lib/phone";

const roles = [
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "DOCTOR", label: "Doctor" },
  { value: "NURSE", label: "Nurse" },
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "LAB_TECH", label: "Lab technician" },
  { value: "ACCOUNTANT", label: "Accountant" },
];

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("RECEPTIONIST");
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

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, mobile, password, role }),
    });
    const data = await response.json();

    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Signup failed.");
      return;
    }

    router.push(`/signup/verify?mobile=${encodeURIComponent(data.mobile)}`);
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Sign up first, then request to join a hospital that is already listed. OTP is 1234 for now."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Role you will work as
          <select
            className={fieldClass}
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {roles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Username
          <input
            className={fieldClass}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Mobile number
          <input
            className={fieldClass}
            inputMode="numeric"
            maxLength={13}
            value={mobile}
            onChange={(event) => setMobile(event.target.value.replace(/[^\d+]/g, ""))}
            placeholder="10-digit mobile — used to sign in"
            autoComplete="tel"
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
            autoComplete="new-password"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link className="font-medium text-teal-700 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        Opening a new hospital?{" "}
        <Link className="font-medium text-teal-700 hover:underline" href="/register-hospital">
          Register hospital
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        <Link className="font-medium text-teal-700 hover:underline" href="/forgot-password">
          Forgot password?
        </Link>
      </p>
    </AuthShell>
  );
}
