"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";

type TierInfo = {
  id: string;
  name: string;
  monthlyFee: number;
  roleSuggestion: string;
};

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function HospitalSubscriptionForm({
  hospitalId,
  currentTierId,
}: {
  hospitalId: string;
  pharmacyEnabled?: boolean;
  labEnabled?: boolean;
  currentTierId?: string;
}) {
  const router = useRouter();
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [tierId, setTierId] = useState(currentTierId ?? "CLINIC");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/public/package")
      .then((response) => response.json())
      .then((data) => {
        if (data.package?.tiers) setTiers(data.package.tiers);
      })
      .catch(() => null);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/platform/hospitals/${hospitalId}/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId, paymentMethod, notes }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update subscription.");
      return;
    }
    setMessage(`Bill generated: ${data.invoice?.invoiceNo ?? "invoice"}.`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
      <h4 className="sm:col-span-2 font-semibold">Change subscription plan</h4>
      <label className="sm:col-span-2 text-sm font-medium text-slate-700">
        Plan
        <select className={fieldClass} value={tierId} onChange={(event) => setTierId(event.target.value)}>
          {tiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.name} — {inr(tier.monthlyFee)}/mo ({tier.roleSuggestion})
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Payment method
        <select
          className={fieldClass}
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
        >
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
        </select>
      </label>
      <label className="sm:col-span-2 text-sm font-medium text-slate-700">
        Notes
        <input className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="sm:col-span-2 text-sm text-teal-700">{message}</p> : null}
      <div className="sm:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Processing…" : "Generate bill & apply plan"}
        </button>
      </div>
    </form>
  );
}
