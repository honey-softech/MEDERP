"use client";

import Image from "next/image";
import { useState } from "react";
import { fieldClass } from "@/lib/ui";

export function PasswordField({
  label = "Password",
  value,
  onChange,
  autoComplete = "current-password",
  required = false,
  id,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? "password";

  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
      {label}
      <span className="relative mt-1 block">
        <input
          id={inputId}
          className={`${fieldClass} mt-0 pr-11`}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-800"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c5 0 9.3 3.1 11 7-.5 1.2-1.2 2.3-2.1 3.2" />
              <path d="M6.1 6.1C4.2 7.4 2.7 9.2 1.9 12c1.7 3.9 6 7 10.1 7 1.6 0 3.1-.3 4.5-.9" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M1.9 12C3.6 8.1 7.9 5 12 5s8.4 3.1 10.1 7c-1.7 3.9-6 7-10.1 7S3.6 15.9 1.9 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </span>
    </label>
  );
}

export function DeveloperCredit() {
  return (
    <div className="mt-8 border-t border-slate-100 pt-5 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Built &amp; developed by</p>
      <div className="mt-2 inline-flex items-center justify-center rounded-md bg-black px-3 py-2">
        <Image
          src="/honeysoftech-logo.png"
          alt="honeysoftech"
          width={160}
          height={36}
          className="h-7 w-auto"
          priority={false}
        />
      </div>
    </div>
  );
}

export function ManagedByCredit() {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
      Managed by <span className="font-semibold tracking-[0.2em] text-slate-600">HANISHA EXIM</span>
    </p>
  );
}
