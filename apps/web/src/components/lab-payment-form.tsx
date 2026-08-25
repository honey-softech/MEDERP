"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";

const CARD_BRANDS = ["Visa", "Mastercard", "RuPay", "Amex", "Other"];

export function LabPaymentForm({
  orderId,
  due,
  tests,
}: {
  orderId: string;
  due: number;
  tests: string[];
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
    const response = await fetch(`/api/lab/orders/${orderId}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        amount: due,
        cardBrand: form.get("cardBrand"),
        cardLast4: form.get("cardLast4"),
        referenceNo: form.get("referenceNo"),
      }),
    });
    const data = await response.json().catch(() => ({ error: "Could not record payment." }));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not record payment.");
      return;
    }
    router.push(data.invoice?.id ? `/billing/${data.invoice.id}` : "/billing/lab");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="font-semibold">Collect lab payment</h3>
        <p className="mt-1 text-sm text-slate-500">
          {due <= 0
            ? "Discount or waiver covers this order. Confirm to notify laboratory."
            : `Collect the balance after discount or waiver, then laboratory can draw the sample. Tests: ${tests.join(", ")}.`}
        </p>
      </div>
      {due > 0 ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["CASH", "CARD", "UPI"] as const).map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3 text-sm font-medium ${
                  method === value ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <input className="sr-only" type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} />
                {value === "CASH" ? "Cash" : value === "CARD" ? "Card" : "UPI"}
              </label>
            ))}
          </div>
          <label className="text-sm font-medium text-slate-700">
            Amount
            <input className={fieldClass} name="amount" value={due.toFixed(2)} readOnly />
          </label>
          {method === "CARD" ? (
            <>
              <label className="text-sm font-medium text-slate-700">
                Card type
                <select className={fieldClass} name="cardBrand" defaultValue="Visa">
                  {CARD_BRANDS.map((brand) => (
                    <option key={brand}>{brand}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Last 4 digits (optional)
                <input className={fieldClass} name="cardLast4" inputMode="numeric" maxLength={4} />
              </label>
            </>
          ) : null}
          {method === "CARD" || method === "UPI" ? (
            <label className="text-sm font-medium text-slate-700">
              Reference no. (optional)
              <input className={fieldClass} name="referenceNo" />
            </label>
          ) : null}
        </>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Collecting…" : due <= 0 ? "Confirm and notify lab" : "Collect and notify lab"}
      </button>
    </form>
  );
}
