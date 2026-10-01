"use client";

import { useEffect, useRef, useState } from "react";
import { compactButtonClass, secondaryButtonClass } from "@/components/auth-shell";

const SENT_FLASH_MS = 1500;

function deriveResendLabel(label: string) {
  const trimmed = label.trim();
  if (/^send\s+on\s+/i.test(trimmed)) {
    return trimmed.replace(/^send\s+on\s+/i, "Resend ");
  }
  if (/^send\s+/i.test(trimmed)) {
    return trimmed.replace(/^send\s+/i, "Resend ");
  }
  if (/^send$/i.test(trimmed)) return "Resend";
  return `Resend ${trimmed}`.replace(/\s+/g, " ").trim();
}

export function SendPatientMessageButton({
  endpoint,
  patientPhone,
  compact = false,
  label = "Send on WhatsApp",
  resendLabel,
  sentLabel = "Sent",
  alreadySent = false,
  className: classNameProp,
}: {
  endpoint: string;
  patientPhone?: string | null;
  compact?: boolean;
  label?: string;
  /** Shown after a successful send (and when alreadySent). Defaults from label. */
  resendLabel?: string;
  /** Brief label right after a successful send, before switching to resend. */
  sentLabel?: string;
  /** True when this message was sent before (e.g. prior WhatsApp summary). */
  alreadySent?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sentOnce, setSentOnce] = useState(alreadySent);
  const [justSent, setJustSent] = useState(false);
  const sentFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phone = (patientPhone ?? "").replace(/\D/g, "");
  const className = classNameProp ?? (compact ? compactButtonClass : secondaryButtonClass);
  const resolvedResendLabel = resendLabel ?? deriveResendLabel(label);
  const buttonLabel = pending
    ? "Sending…"
    : justSent
      ? sentLabel
      : sentOnce
        ? resolvedResendLabel
        : label;

  useEffect(() => {
    setSentOnce(alreadySent);
  }, [alreadySent]);

  useEffect(() => {
    return () => {
      if (sentFlashTimer.current) clearTimeout(sentFlashTimer.current);
    };
  }, []);

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
      setError(data.error ?? "Could not send the message.");
      return;
    }
    setSentOnce(true);
    setJustSent(true);
    if (sentFlashTimer.current) clearTimeout(sentFlashTimer.current);
    sentFlashTimer.current = setTimeout(() => setJustSent(false), SENT_FLASH_MS);
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        className={className}
        disabled={pending || justSent}
        title={error || undefined}
        onClick={() => void send()}
      >
        {buttonLabel}
      </button>
      {error ? (
        <span className="absolute left-0 top-full z-10 mt-1 max-w-[14rem] rounded bg-surface px-1.5 py-0.5 text-[11px] text-red-600 shadow-card">
          {error}
        </span>
      ) : null}
    </span>
  );
}
