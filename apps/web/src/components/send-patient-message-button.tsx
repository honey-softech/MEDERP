"use client";

import { useState } from "react";
import { compactButtonClass, secondaryButtonClass } from "@/components/auth-shell";

export function SendPatientMessageButton({
  appointmentId,
  patientPhone,
  compact = false,
}: {
  appointmentId: string;
  patientPhone?: string | null;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const phone = (patientPhone ?? "").replace(/\D/g, "");
  const className = compact ? compactButtonClass : secondaryButtonClass;

  async function send() {
    if (phone.length < 10) {
      setError("Add a 10-digit mobile number on the patient record first.");
      return;
    }
    setPending(true);
    setError("");
    setDone("");
    const response = await fetch(`/api/appointments/${appointmentId}/investigations/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "SMS" }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not queue the message.");
      return;
    }
    setDone("Queued");
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" className={className} disabled={pending} onClick={() => void send()}>
        {pending ? "Sending…" : done || "Send"}
      </button>
      {error ? <span className="mt-1 text-[11px] text-red-600">{error}</span> : null}
    </span>
  );
}
