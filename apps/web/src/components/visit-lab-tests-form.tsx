"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BloodTestPicker } from "@/components/blood-test-picker";
import { compactPrimaryButtonClass } from "@/components/auth-shell";
import type { InvestigationPick } from "@/lib/lab-catalog";

export function VisitLabTestsForm({
  appointmentId,
  initialTestIds = [],
  initialInvestigations,
  locked = false,
  labEnabled = true,
  patientPhone = null,
  priorOrderCount = 0,
  variant = "card",
}: {
  appointmentId: string;
  initialTestIds?: string[];
  initialInvestigations?: InvestigationPick[];
  locked?: boolean;
  labEnabled?: boolean;
  patientPhone?: string | null;
  priorOrderCount?: number;
  variant?: "card" | "toolbar";
}) {
  const router = useRouter();
  const [investigations, setInvestigations] = useState<InvestigationPick[]>(
    initialInvestigations ?? initialTestIds.map((testId) => ({ testId })),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const hasPicks = investigations.length > 0;

  async function save() {
    if (!hasPicks) return;
    setError("");
    setPending(true);
    const response = await fetch(`/api/appointments/${appointmentId}/assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lab-tests", investigations }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update tests.");
      return;
    }
    setInvestigations([]);
    router.refresh();
  }

  if (variant === "toolbar") {
    return (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <BloodTestPicker
          variant="toolbar"
          selectedInvestigations={investigations}
          onInvestigationsChange={setInvestigations}
          locked={locked}
          labEnabled={labEnabled}
          patientPhone={patientPhone}
          priorOrderCount={priorOrderCount}
          printHref={`/appointments/${appointmentId}/investigations`}
        />
        {!locked && hasPicks ? (
          <button
            className={compactPrimaryButtonClass}
            type="button"
            disabled={pending}
            onClick={() => void save()}
          >
            {pending ? "Saving…" : priorOrderCount > 0 ? "Order more" : "Save tests"}
          </button>
        ) : null}
        {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-2.5 shadow-card">
      <BloodTestPicker
        selectedInvestigations={investigations}
        onInvestigationsChange={setInvestigations}
        locked={locked}
        labEnabled={labEnabled}
        patientPhone={patientPhone}
        priorOrderCount={priorOrderCount}
        printHref={`/appointments/${appointmentId}/investigations`}
      />
      {!hasPicks ? (
        <p className="text-[11px] text-text-secondary">
          {priorOrderCount > 0
            ? "Reports on file — add another wave if needed."
            : "No tests ordered on this visit. Add if needed after the consult."}
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {!locked && hasPicks ? (
        <button
          className={`${compactPrimaryButtonClass} w-full`}
          type="button"
          disabled={pending}
          onClick={() => void save()}
        >
          {pending ? "Saving…" : priorOrderCount > 0 ? "Order more tests / scans" : "Save tests / scans"}
        </button>
      ) : null}
    </div>
  );
}
