"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

type RxLine = {
  id: string;
  medicineName: string;
  doseNotes: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  inStock: boolean;
  batch: { batchNo: string; expiryDate: string } | null;
};

export function PharmacyRxCollectForm({
  appointmentId,
  initialLines,
  initialTotal,
  patientLabel,
  doctorLabel,
}: {
  appointmentId: string;
  initialLines: RxLine[];
  initialTotal: number;
  patientLabel: string;
  doctorLabel: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [total, setTotal] = useState(initialTotal);
  const [method, setMethod] = useState<"CASH" | "CARD" | "UPI">("CASH");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const allInStock = lines.length > 0 && lines.every((line) => line.inStock);

  async function refreshPricing(nextLines: RxLine[]) {
    setPending("qty");
    setError("");
    const response = await fetch(`/api/pharmacy/prescriptions/${appointmentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-qty",
        lines: nextLines.map((line) => ({ lineId: line.id, quantity: line.quantity })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not update quantities.");
      return;
    }
    const refreshed = data.order?.lines ?? [];
    setLines(
      refreshed.map((line: Record<string, unknown>) => ({
        id: String(line.id),
        medicineName: String(line.medicineName),
        doseNotes: line.doseNotes != null ? String(line.doseNotes) : null,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        lineTotal: Number(line.lineTotal),
        inStock: Boolean(line.inStock),
        batch: line.batch
          ? {
              batchNo: String((line.batch as { batchNo: string }).batchNo),
              expiryDate: String((line.batch as { expiryDate: string }).expiryDate),
            }
          : null,
      })),
    );
    setTotal(Number(data.order?.totalAmount ?? 0));
  }

  async function collect() {
    setPending("collect");
    setError("");
    setOk("");
    const response = await fetch(`/api/pharmacy/prescriptions/${appointmentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "collect", method }),
    });
    const data = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not collect payment.");
      return;
    }
    setOk("Payment recorded, stock updated, invoice generated.");
    router.push(data.invoiceId ? `/billing/${data.invoiceId}` : "/pharmacy/prescriptions");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <p className="text-sm text-text-secondary">
          {patientLabel} · Dr {doctorLabel}
        </p>
        {!allInStock ? (
          <p className="mt-2 rounded-lg border border-warning/40 bg-warning-bg px-3 py-2 text-sm text-warning">
            Some medicines are out of stock. Receive stock (GRN) or reduce quantities before billing.
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-app-bg text-xs text-text-secondary">
            <tr>
              <th className="px-3 py-2 font-semibold">Medicine</th>
              <th className="px-3 py-2 font-semibold">Dose</th>
              <th className="px-3 py-2 font-semibold">Qty</th>
              <th className="px-3 py-2 font-semibold">Batch (FEFO)</th>
              <th className="px-3 py-2 font-semibold">MRP</th>
              <th className="px-3 py-2 font-semibold">Line</th>
              <th className="px-3 py-2 font-semibold">Stock</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{line.medicineName}</td>
                <td className="px-3 py-2 text-text-secondary">{line.doseNotes || "—"}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    className="h-9 w-16 rounded-md border border-border px-2"
                    value={line.quantity}
                    onChange={(event) => {
                      const qty = Number(event.target.value);
                      setLines((current) =>
                        current.map((row) => (row.id === line.id ? { ...row, quantity: qty } : row)),
                      );
                    }}
                    onBlur={(event) => {
                      const qty = Math.max(1, Number(event.target.value) || 1);
                      setLines((current) => {
                        const next = current.map((row) =>
                          row.id === line.id ? { ...row, quantity: qty } : row,
                        );
                        void refreshPricing(next);
                        return next;
                      });
                    }}
                  />
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {line.batch
                    ? `${line.batch.batchNo} · exp ${new Date(line.batch.expiryDate).toLocaleDateString("en-IN")}`
                    : "—"}
                </td>
                <td className="px-3 py-2">₹{line.unitPrice.toFixed(2)}</td>
                <td className="px-3 py-2 font-medium">₹{line.lineTotal.toFixed(2)}</td>
                <td className="px-3 py-2">
                  <span className={line.inStock ? "text-success" : "text-critical"}>
                    {line.inStock ? "Yes" : "No"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-border px-4 py-3 text-base font-semibold">
          Total: ₹{total.toFixed(2)}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card sm:grid-cols-3">
        <label className="text-sm font-medium text-text-primary">
          Payment method
          <select className={fieldClass} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={Boolean(pending) || !allInStock || total <= 0}
          onClick={() => void collect()}
        >
          {pending === "collect" ? "Processing…" : "Collect payment & dispense"}
        </button>
        <button type="button" className={secondaryButtonClass} onClick={() => router.push("/pharmacy/prescriptions")}>
          Back to queue
        </button>
      </div>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}
    </div>
  );
}
