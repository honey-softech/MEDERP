"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { compactButtonClass } from "@/components/auth-shell";
import { SendPatientMessageButton } from "@/components/send-patient-message-button";

export function DoctorVisitActions({
  id,
  status,
  summaryApproved = false,
  patientPhone,
  summaryAlreadySent = false,
  assessmentHref,
  summaryHref,
  assessmentLabel,
  summaryLabel,
}: {
  id: string;
  status: string;
  summaryApproved?: boolean;
  patientPhone?: string | null;
  summaryAlreadySent?: boolean;
  assessmentHref?: string;
  summaryHref?: string;
  assessmentLabel?: string;
  summaryLabel?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function run(action: string) {
    setError("");
    setPending(action);
    const response = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const raw = await response.text();
    let data: { error?: string } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: "Could not update the visit." };
    }
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not update the visit.");
      return;
    }
    if (action === "start" && assessmentHref) {
      router.push(assessmentHref);
      return;
    }
    router.refresh();
  }

  const sendButton = summaryApproved ? (
    <SendPatientMessageButton
      endpoint={`/api/appointments/${id}/summary/send`}
      patientPhone={patientPhone}
      compact
      label="Send on WhatsApp"
      alreadySent={summaryAlreadySent}
    />
  ) : null;

  const closed = ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(status) || summaryApproved;
  if (closed) {
    if (status === "CANCELLED" || status === "NO_SHOW") return null;
    // Visit detail page already shows WhatsApp / Print / Edit in the header — avoid duplicates.
    if (!assessmentHref && !summaryHref) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {assessmentHref ? (
          <Link href={assessmentHref} className={compactButtonClass}>
            {assessmentLabel ?? "View visit"}
          </Link>
        ) : null}
        {sendButton}
        {summaryHref ? (
          <Link href={summaryHref} className={compactButtonClass}>
            {summaryLabel ?? "Print record"}
          </Link>
        ) : null}
      </div>
    );
  }

  const consultStarted = status === "IN_PROGRESS";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {consultStarted ? null : (
        <button
          className={compactButtonClass}
          type="button"
          disabled={Boolean(pending)}
          onClick={() => void run("start")}
        >
          {pending === "start" ? "Starting…" : "Start consult"}
        </button>
      )}
      {consultStarted && assessmentHref ? (
        <Link href={assessmentHref} className={compactButtonClass}>
          {assessmentLabel ?? "Doctor assessment"}
        </Link>
      ) : null}
      {sendButton}
      {summaryHref ? (
        <Link href={summaryHref} className={compactButtonClass}>
          {summaryLabel ?? "Preview summary"}
        </Link>
      ) : null}
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
