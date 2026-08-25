import Link from "next/link";
import { ExternalReportForm } from "@/components/external-report-form";
import { primaryButtonClass } from "@/components/auth-shell";
import { inr } from "@/lib/front-desk";
import { labStatusClass, prettyLabStatus } from "@/lib/lab-catalog";

type LabItem = {
  id: string;
  nameSnapshot: string;
  categorySnapshot: string;
  unitPrice: { toString(): string } | number;
};

type LabOrder = {
  id: string;
  status: string;
  fulfillment?: string;
  totalAmount: { toString(): string } | number;
  reportFileName?: string | null;
  items: LabItem[];
};

export function LabOrderPanel({
  orders,
  canCollect = false,
  canWork = false,
  canViewReport = false,
  canAttachExternal = false,
  patientPhone = null,
}: {
  orders: LabOrder[];
  canCollect?: boolean;
  canWork?: boolean;
  canViewReport?: boolean;
  canAttachExternal?: boolean;
  patientPhone?: string | null;
}) {
  if (orders.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="font-semibold">Investigations</h4>
      <p className="text-xs text-slate-500">
        Each paid or completed request stays listed. The doctor can order another set anytime on this visit.
      </p>
      {orders.map((order) => {
        const external = order.fulfillment === "EXTERNAL";
        return (
          <article key={order.id} className="rounded-xl border border-slate-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${labStatusClass(order.status)}`}>
                {prettyLabStatus(order.status)}
              </span>
              {external ? (
                <span className="text-xs font-medium text-slate-500">Done outside</span>
              ) : (
                <span className="text-sm font-medium">{inr(order.totalAmount)}</span>
              )}
            </div>
            {external ? (
              <p className="mt-2 text-xs text-slate-500">
                {patientPhone
                  ? `Patient mobile ${patientPhone}. WhatsApp/SMS of this list will be sent later.`
                  : "No mobile on file. Add a number on the patient record so the list can be sent later."}
              </p>
            ) : null}
            <ul className="mt-3 space-y-2 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium">{item.nameSnapshot}</p>
                  <p className="text-xs text-slate-500">{item.categorySnapshot}</p>
                </li>
              ))}
            </ul>
            {(canViewReport || (external && canAttachExternal)) && order.status === "RESULTED" && order.reportFileName ? (
              <p className="mt-3 text-sm">
                <a className="font-medium text-teal-700 hover:underline" href={`/api/lab/orders/${order.id}/report`}>
                  Open report · {order.reportFileName}
                </a>
              </p>
            ) : order.status === "RESULTED" ? (
              <p className="mt-3 text-xs text-slate-500">Report is on the patient record for the doctor and nurse.</p>
            ) : external ? (
              <p className="mt-3 text-xs text-slate-500">Waiting for the patient to bring the outside report.</p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Lab report pending</p>
            )}
            {external && canAttachExternal && order.status !== "CANCELLED" ? (
              <ExternalReportForm
                orderId={order.id}
                reportFileName={order.reportFileName}
                locked={order.status === "RESULTED"}
              />
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {canCollect && !external && order.status === "AWAITING_PAYMENT" ? (
                <Link href={`/billing/lab/${order.id}`} className={primaryButtonClass}>
                  Collect lab payment
                </Link>
              ) : null}
              {canWork && !external && (order.status === "PAID" || order.status === "SAMPLE_COLLECTED") ? (
                <Link href={`/lab/${order.id}`} className={primaryButtonClass}>
                  Update lab work
                </Link>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
