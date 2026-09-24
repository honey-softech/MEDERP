"use client";

import { useState } from "react";
import { secondaryButtonClass } from "@/components/auth-shell";

export function ReferralCodeCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the code and copy it manually.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="font-mono text-lg font-semibold tracking-wide">{code}</p>
      <button type="button" className={secondaryButtonClass} onClick={() => void copy()}>
        {copied ? "Copied" : "Copy code"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
