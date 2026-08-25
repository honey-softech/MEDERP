"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { PatientPicker } from "@/components/patient-picker";

type Option = { id: string; label: string };

export function InvoiceCreateForm({
  appointments,
}: {
  appointments: Option[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const appointmentId = String(form.get("appointmentId") ?? "");
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: form.get("patientId"),
        appointmentId: appointmentId || undefined,
        discountAmount: Number(form.get("discountAmount") ?? 0),
        description: form.get("description"),
        items: appointmentId
          ? undefined
          : [{ description: String(form.get("description") || "Consultation fee"), amount: Number(form.get("amount") ?? 0) }],
      }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not create invoice.");
      return;
    }
    router.push(`/billing/${data.invoice.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-4xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <PatientPicker />
      </div>
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Linked appointment (optional, uses consultation fee)
        <select className={fieldClass} name="appointmentId">
          <option value="">No appointment — enter amount</option>
          {appointments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Description
        <input className={fieldClass} name="description" defaultValue="Consultation fee" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Amount (if no appointment)
        <input className={fieldClass} name="amount" type="number" min="0" step="0.01" defaultValue="500" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Discount
        <input className={fieldClass} name="discountAmount" type="number" min="0" step="0.01" defaultValue="0" />
      </label>
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Creating…" : "Issue invoice"}
        </button>
      </div>
    </form>
  );
}

export function InvoiceActions({
  invoiceId,
  due,
  paid,
  canApproveWaiver,
  canRequestWaiver = true,
  waiverStatus,
  fullPaymentRequired = false,
}: {
  invoiceId: string;
  due: number;
  paid: number;
  canApproveWaiver: boolean;
  canRequestWaiver?: boolean;
  waiverStatus: string;
  fullPaymentRequired?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function run(action: string, extra: Record<string, unknown>) {
    setError("");
    setPending(action);
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await response.json();
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <InvoiceAdjustments
        invoiceId={invoiceId}
        paid={paid}
        canApproveWaiver={canApproveWaiver}
        canRequestWaiver={canRequestWaiver}
        waiverStatus={waiverStatus}
        pending={pending}
        error={error}
        onRun={run}
      />

      {due > 0 ? (
        <form
          className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run("pay", {
              method: form.get("method"),
              amount: Number(form.get("amount")),
              notes: form.get("notes"),
            });
          }}
        >
          <h4 className="sm:col-span-4 font-medium">Collect payment</h4>
          <label className="text-sm font-medium text-slate-700">
            Method
            <select className={fieldClass} name="method" defaultValue="CASH">
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
              <option value="INSURANCE">Insurance</option>
              <option value="ADVANCE">From advance</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Amount
            <input
              className={fieldClass}
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={due.toFixed(2)}
              required
              readOnly={fullPaymentRequired}
            />
            {fullPaymentRequired ? (
              <span className="mt-1 block font-normal text-slate-500">Full amount only. Partial payment is not allowed at check-in.</span>
            ) : null}
          </label>
          <label className="text-sm font-medium text-slate-700">
            Notes
            <input className={fieldClass} name="notes" />
          </label>
          <div className="flex items-end">
            <button className={buttonClass} type="submit" disabled={pending === "pay"}>
              Collect
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function InvoiceAdjustments({
  invoiceId,
  paid,
  canApproveWaiver,
  canRequestWaiver = true,
  waiverStatus,
  pending: pendingProp,
  error: errorProp,
  onRun,
}: {
  invoiceId: string;
  paid: number;
  canApproveWaiver: boolean;
  canRequestWaiver?: boolean;
  waiverStatus: string;
  pending?: string;
  error?: string;
  onRun?: (action: string, extra: Record<string, unknown>) => Promise<void> | void;
}) {
  const router = useRouter();
  const [error, setError] = useState(errorProp ?? "");
  const [pending, setPending] = useState(pendingProp ?? "");

  async function run(action: string, extra: Record<string, unknown>) {
    if (onRun) {
      await onRun(action, extra);
      return;
    }
    setError("");
    setPending(action);
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await response.json();
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }
    router.refresh();
  }

  const busy = pendingProp ?? pending;
  const shownError = errorProp ?? error;

  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run("discount", { amount: Number(form.get("amount")) });
        }}
      >
        <h4 className="sm:col-span-3 font-medium">Discount</h4>
        <label className="text-sm font-medium text-slate-700">
          Amount
          <input className={fieldClass} name="amount" type="number" min="0" step="0.01" required />
        </label>
        <div className="flex items-end">
          <button className={secondaryButtonClass} type="submit" disabled={busy === "discount"}>
            Apply discount
          </button>
        </div>
      </form>

      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run("waiver-request", { amount: Number(form.get("amount")), reason: form.get("reason") });
        }}
      >
        <h4 className="sm:col-span-3 font-medium">Waiver (needs approval)</h4>
        {waiverStatus === "PENDING" ? (
          <p className="sm:col-span-3 text-sm text-amber-800">Waiver is waiting for Super Admin or accountant approval.</p>
        ) : null}
        {waiverStatus === "APPROVED" ? (
          <p className="sm:col-span-3 text-sm text-teal-800">Waiver approved. Collect the reduced amount below.</p>
        ) : null}
        <label className="text-sm font-medium text-slate-700">
          Amount
          <input className={fieldClass} name="amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Reason
          <input className={fieldClass} name="reason" required />
        </label>
        <div className="flex items-end gap-2">
          {canRequestWaiver ? (
            <button className={secondaryButtonClass} type="submit" disabled={busy === "waiver-request"}>
              Request waiver
            </button>
          ) : null}
          {canApproveWaiver && waiverStatus === "PENDING" ? (
            <>
              <button className={secondaryButtonClass} type="button" onClick={() => void run("waiver-decide", { approve: true })}>
                Approve
              </button>
              <button className={secondaryButtonClass} type="button" onClick={() => void run("waiver-decide", { approve: false })}>
                Reject
              </button>
            </>
          ) : null}
        </div>
      </form>

      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run("refund", {
            method: form.get("method"),
            amount: Number(form.get("amount")),
            notes: form.get("notes"),
          });
        }}
      >
        <h4 className="sm:col-span-4 font-medium">Refund</h4>
        <label className="text-sm font-medium text-slate-700">
          Method
          <select className={fieldClass} name="method" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="UPI">UPI</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Amount
          <input className={fieldClass} name="amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Notes
          <input className={fieldClass} name="notes" />
        </label>
        <div className="flex items-end">
          <button className={secondaryButtonClass} type="submit" disabled={busy === "refund" || paid <= 0}>
            Process refund
          </button>
        </div>
      </form>

      {shownError ? <p className="text-sm text-red-600">{shownError}</p> : null}
    </div>
  );
}

export function AdvanceForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/payments/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: form.get("patientId"),
        method: form.get("method"),
        amount: Number(form.get("amount")),
        notes: form.get("notes"),
      }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not collect advance.");
      return;
    }
    router.push("/billing");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <PatientPicker />
      </div>
      <label className="text-sm font-medium text-slate-700">
        Method
        <select className={fieldClass} name="method" defaultValue="CASH">
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="UPI">UPI</option>
          <option value="INSURANCE">Insurance</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Amount
        <input className={fieldClass} name="amount" type="number" min="0.01" step="0.01" required />
      </label>
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Notes
        <input className={fieldClass} name="notes" defaultValue="Advance for admission" />
      </label>
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Collect advance"}
        </button>
      </div>
    </form>
  );
}
