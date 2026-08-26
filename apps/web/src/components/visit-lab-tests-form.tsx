"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BloodTestPicker } from "@/components/blood-test-picker";
import { primaryButtonClass } from "@/components/auth-shell";
import type { InvestigationPick } from "@/lib/lab-catalog";

export function VisitLabTestsForm({
  appointmentId,
  initialTestIds = [],
  initialInvestigations,
  locked = false,
  labEnabled = true,
  patientPhone = null,
  priorOrderCount = 0,
}: {
  appointmentId: string;
  initialTestIds?: string[];
  initialInvestigations?: InvestigationPick[];
  locked?: boolean;
  labEnabled?: boolean;
  patientPhone?: string | null;
  priorOrderCount?: number;
}) {
  const router = useRouter();
  const [investigations, setInvestigations] = useState<InvestigationPick[]>(
    initialInvestigations ?? initialTestIds.map((testId) => ({ testId })),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
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
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <BloodTestPicker
        selectedInvestigations={investigations}
        onInvestigationsChange={setInvestigations}
        locked={locked}
        labEnabled={labEnabled}
        patientPhone={patientPhone}
        priorOrderCount={priorOrderCount}
        printHref={`/appointments/${appointmentId}/investigations`}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {locked ? null : (
        <button className={primaryButtonClass} type="button" disabled={pending} onClick={() => void save()}>
          {pending ? "Saving…" : priorOrderCount > 0 ? "Order more tests / scans" : "Save tests / scans"}
        </button>
      )}
    </div>
  );
}
