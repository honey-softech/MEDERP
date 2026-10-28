"use client";

import { useState } from "react";
import { iconButtonClass } from "@/lib/ui";

export function OpenOnWeb({ message, url }: { message: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the address and copy it manually.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p>{message}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 break-all font-mono text-[13px] text-slate-900">{url}</p>
        <button type="button" className={iconButtonClass} aria-label={copied ? "Copied" : "Copy link"} onClick={() => void copy()}>
          {copied ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
