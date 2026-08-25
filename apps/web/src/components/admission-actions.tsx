"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

type Option = { id: string; label: string };

export function AdmissionActions({
  admissionId,
  status,
  invoiceId,
  availableBeds,
  canTransfer,
  canAdvise,
  canDischarge,
  canBill,
  canCancel,
}: {
  admissionId: string;
  status: string;
  invoiceId?: string | null;
  availableBeds: Option[];
  canTransfer: boolean;
  canAdvise: boolean;
  canDischarge: boolean;
  canBill: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setError("");
    setPending(action);
    const response = await fetch(`/api/admissions/${admissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not update the admission.");
      return;
    }
    if (action === "discharge" && data.invoiceId) {
      router.push(`/billing/${data.invoiceId}`);
      router.refresh();
      return;
    }
    if (action === "invoice" && data.invoice?.id) {
      router.push(`/billing/${data.invoice.id}`);
      router.refresh();
      return;
    }
    router.refresh();
  }

  const active = status === "ADMITTED" || status === "DISCHARGE_ADVISED";

  return (
    <div className="space-y-4">
      {canAdvise && status === "ADMITTED" ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-medium">Doctor discharge advice</p>
          <p className="mt-1 text-sm text-slate-500">Marks the stay ready for reception to bill and vacate the bed.</p>
          <button
            type="button"
            className={`${primaryButtonClass} mt-3`}
            disabled={Boolean(pending)}
            onClick={() => void run("advise-discharge")}
          >
            {pending === "advise-discharge" ? "Saving…" : "Advise discharge"}
          </button>
        </div>
      ) : null}

      {canTransfer && active ? (
        <form
          className="rounded-2xl border border-slate-200 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run("transfer", { toBedId: form.get("toBedId"), reason: form.get("reason") });
          }}
        >
          <p className="text-sm font-medium">Transfer bed</p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            New bed
            <select className={fieldClass} name="toBedId" required>
              <option value="">Select available bed</option>
              {availableBeds.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Reason
            <input className={fieldClass} name="reason" placeholder="Step-up to ICU, private request…" />
          </label>
          <button className={`${secondaryButtonClass} mt-3`} type="submit" disabled={Boolean(pending) || availableBeds.length === 0}>
            {pending === "transfer" ? "Transferring…" : "Transfer"}
          </button>
        </form>
      ) : null}

      {canBill && active ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-medium">IPD bill</p>
          <p className="mt-1 text-sm text-slate-500">
            Accrues bed and nursing charges for the stay so far. Advance is applied when available.
          </p>
          {invoiceId ? (
            <Link href={`/billing/${invoiceId}`} className={`${primaryButtonClass} mt-3 inline-flex`}>
              Open existing bill
            </Link>
          ) : (
            <button
              type="button"
              className={`${primaryButtonClass} mt-3`}
              disabled={Boolean(pending)}
              onClick={() => void run("invoice")}
            >
              {pending === "invoice" ? "Creating…" : "Generate IPD bill"}
            </button>
          )}
        </div>
      ) : null}

      {canDischarge && active ? (
        <form
          className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run("discharge", {
              dischargeType: form.get("dischargeType"),
              notes: form.get("notes"),
              applyAdvance: true,
            });
          }}
        >
          <p className="text-sm font-medium">Discharge</p>
          <p className="mt-1 text-sm text-slate-600">
            Vacates the bed (housekeeping), issues the IPD bill, and applies any advance.
          </p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Discharge type
            <select className={fieldClass} name="dischargeType" defaultValue="ROUTINE">
              <option value="ROUTINE">Routine</option>
              <option value="LAMA">LAMA</option>
              <option value="ABSCONDED">Absconded</option>
              <option value="DEATH">Death</option>
              <option value="TRANSFER_OUT">Transfer to another hospital</option>
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Notes
            <input className={fieldClass} name="notes" />
          </label>
          <button className={`${buttonClass} mt-3`} type="submit" disabled={Boolean(pending)}>
            {pending === "discharge" ? "Discharging…" : "Discharge patient"}
          </button>
        </form>
      ) : null}

      {canCancel && active ? (
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={Boolean(pending)}
          onClick={() => {
            if (window.confirm("Cancel this admission and free the bed?")) void run("cancel");
          }}
        >
          {pending === "cancel" ? "Cancelling…" : "Cancel admission"}
        </button>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
