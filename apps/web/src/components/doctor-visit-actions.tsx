"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { compactPrimaryButtonClass, compactButtonClass } from "@/components/auth-shell";

export function DoctorVisitActions({
  id,
  status,
  summaryApproved = false,
  assessmentHref,
  summaryHref,
  assessmentLabel,
  summaryLabel,
  showHint = true,
}: {
  id: string;
  status: string;
  summaryApproved?: boolean;
  assessmentHref?: string;
  summaryHref?: string;
  assessmentLabel?: string;
  summaryLabel?: string;
  showHint?: boolean;
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
    router.refresh();
  }

  const closed = ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(status);
  if (closed) {
    if (status !== "COMPLETED") return null;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <p className="text-xs font-medium text-teal-800">Visit marked done.</p>
        {assessmentHref ? (
          <Link href={assessmentHref} className={compactButtonClass}>
            {assessmentLabel ?? "View visit"}
          </Link>
        ) : null}
        {summaryHref ? (
          <Link href={summaryHref} className={compactButtonClass}>
            {summaryLabel ?? "Print record"}
          </Link>
        ) : null}
      </div>
    );
  }

  const showStart = status !== "IN_PROGRESS";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showStart ? (
        <button
          className={compactButtonClass}
          type="button"
          disabled={Boolean(pending)}
          onClick={() => void run("start")}
        >
          {pending === "start" ? "Starting…" : "Start consult"}
        </button>
      ) : null}
      {assessmentHref ? (
        <Link href={assessmentHref} className={compactButtonClass}>
          {assessmentLabel ?? "Doctor assessment"}
        </Link>
      ) : null}
      {summaryHref ? (
        <Link href={summaryHref} className={compactButtonClass}>
          {summaryLabel ?? "Preview summary"}
        </Link>
      ) : null}
      <button
        className={compactPrimaryButtonClass}
        type="button"
        disabled={Boolean(pending) || !summaryApproved}
        title={!summaryApproved ? "Approve the summary before marking done" : undefined}
        onClick={() => void run("complete")}
      >
        {pending === "complete" ? "Saving…" : "Done"}
      </button>
      {showHint && !summaryApproved ? (
        <p className="w-full text-xs text-text-secondary sm:w-auto">Approve the summary before marking done.</p>
      ) : null}
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
