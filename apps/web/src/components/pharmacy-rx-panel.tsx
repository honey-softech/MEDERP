import Link from "next/link";
import { primaryButtonClass } from "@/components/auth-shell";
import { inr } from "@/lib/front-desk";

export function PharmacyRxPanel({
  order,
  canBill,
}: {
  order: {
    id: string;
    appointmentId: string;
    status: string;
    totalAmount: number;
    lines: Array<{ medicineName: string; quantity: number; inStock: boolean; doseNotes: string | null }>;
    invoiceId: string | null;
  };
  canBill: boolean;
}) {
  const inStock = order.lines.filter((line) => line.inStock).length;
  const pending = order.status === "AWAITING_PAYMENT";

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-text-primary">Pharmacy prescription</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {pending
              ? `${order.lines.length} medicine(s) · ${inStock}/${order.lines.length} in stock · ${inr(order.totalAmount)}`
              : `Dispensed · ${inr(order.totalAmount)}`}
          </p>
        </div>
        {canBill && pending ? (
          <Link href={`/pharmacy/prescriptions/${order.appointmentId}`} className={primaryButtonClass}>
            Collect pharmacy bill
          </Link>
        ) : null}
        {!pending && order.invoiceId ? (
          <Link href={`/billing/${order.invoiceId}`} className={primaryButtonClass}>
            View pharmacy invoice
          </Link>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {order.lines.map((line) => (
          <li key={`${line.medicineName}-${line.doseNotes}`} className="flex flex-wrap gap-2">
            <span className="font-medium">{line.medicineName}</span>
            <span className="text-text-secondary">× {line.quantity}</span>
            {line.doseNotes ? <span className="text-text-secondary">· {line.doseNotes}</span> : null}
            <span className={line.inStock ? "text-success" : "text-critical"}>
              {line.inStock ? "In stock" : "Out of stock"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
