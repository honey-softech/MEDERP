"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";

const CARD_BRANDS = ["Visa", "Mastercard", "RuPay", "Amex", "Other"];

export function VisitPaymentForm({
  appointmentId,
  due,
  doctorLabel,
  amountLocked = false,
}: {
  appointmentId: string;
  due: number;
  doctorLabel: string;
  amountLocked?: boolean;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"CASH" | "CARD" | "UPI">("CASH");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/appointments/${appointmentId}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        amount: Number(form.get("amount")),
        cardBrand: form.get("cardBrand"),
        cardLast4: form.get("cardLast4"),
        referenceNo: form.get("referenceNo"),
        notes: form.get("notes"),
      }),
    });
    const data = await response.json().catch(() => ({ error: "Could not record payment." }));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not record payment.");
      return;
    }
    router.push(data.invoice?.id ? `/billing/${data.invoice.id}` : "/billing/collections");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="font-semibold">Record payment</h3>
        <p className="mt-1 text-sm text-slate-500">
          Consultation is credited to {doctorLabel}. Collect the full OPD amount — partial payment is not allowed.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ["CASH", "Cash"],
            ["CARD", "Card"],
            ["UPI", "UPI"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3 text-sm font-medium ${
              method === value ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            <input
              className="sr-only"
              type="radio"
              name="method"
              value={value}
              checked={method === value}
              onChange={() => setMethod(value)}
            />
            {label}
          </label>
        ))}
      </div>

      <label className="text-sm font-medium text-slate-700">
        OPD amount (₹)
        <input
          className={fieldClass}
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={due.toFixed(2)}
          required
          readOnly={amountLocked}
        />
        <span className="mt-1 block font-normal text-slate-500">
          {amountLocked
            ? "Pay this full balance. Partial payment is not allowed at check-in."
            : "Default is ₹500 (or the hospital OPD rate). You can enter a different amount, then collect it in full."}
        </span>
      </label>

      {method === "CASH" ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">This will be recorded as cash collection.</p>
      ) : null}

      {method === "CARD" ? (
        <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Card type
            <select className={fieldClass} name="cardBrand" required>
              {CARD_BRANDS.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Last 4 digits
            <input className={fieldClass} name="cardLast4" inputMode="numeric" maxLength={4} placeholder="Optional" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Approval / txn no.
            <input className={fieldClass} name="referenceNo" placeholder="Optional" />
          </label>
        </div>
      ) : null}

      {method === "UPI" ? (
        <label className="text-sm font-medium text-slate-700">
          UPI reference
          <input className={fieldClass} name="referenceNo" placeholder="UPI txn ID" />
        </label>
      ) : null}

      <label className="text-sm font-medium text-slate-700">
        Notes
        <input className={fieldClass} name="notes" placeholder="Optional" />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : method === "CASH" ? "Record cash payment" : method === "CARD" ? "Record card payment" : "Record UPI payment"}
        </button>
        <button className={secondaryButtonClass} type="button" onClick={() => router.push("/queue")}>
          Skip for now
        </button>
      </div>
    </form>
  );
}
