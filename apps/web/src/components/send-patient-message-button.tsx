"use client";

import { useState } from "react";
import { compactButtonClass, secondaryButtonClass } from "@/components/auth-shell";

export function SendPatientMessageButton({
  endpoint,
  patientPhone,
  compact = false,
  label = "Send WhatsApp",
  resendLabel = "Resend WhatsApp",
  alreadySent = false,
  className: classNameProp,
}: {
  endpoint: string;
  patientPhone?: string | null;
  compact?: boolean;
  label?: string;
  /** Shown after a successful send (and when alreadySent). */
  resendLabel?: string;
  /** True when this message was sent before (e.g. prior WhatsApp summary). */
  alreadySent?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sentOnce, setSentOnce] = useState(alreadySent);
  const phone = (patientPhone ?? "").replace(/\D/g, "");
  const className = classNameProp ?? (compact ? compactButtonClass : secondaryButtonClass);
  const buttonLabel = sentOnce ? resendLabel : label;

  async function send() {
    if (phone.length < 10) {
      setError("Add a 10-digit mobile number on the patient record first.");
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "WHATSAPP" }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not queue the message.");
      return;
    }
    setSentOnce(true);
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        className={className}
        disabled={pending}
        title={error || undefined}
        onClick={() => void send()}
      >
        {pending ? "Sending…" : buttonLabel}
      </button>
      {error ? (
        <span className="absolute left-0 top-full z-10 mt-1 max-w-[14rem] rounded bg-surface px-1.5 py-0.5 text-[11px] text-red-600 shadow-card">
          {error}
        </span>
      ) : null}
    </span>
  );
}
