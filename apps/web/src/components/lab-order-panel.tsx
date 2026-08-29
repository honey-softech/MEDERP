import Link from "next/link";
import { ExternalReportForm } from "@/components/external-report-form";
import { SendPatientMessageButton } from "@/components/send-patient-message-button";
import { compactButtonClass, compactPrimaryButtonClass } from "@/components/auth-shell";
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
  canPrint = false,
  appointmentId = "",
  patientPhone = null,
}: {
  orders: LabOrder[];
  canCollect?: boolean;
  canWork?: boolean;
  canViewReport?: boolean;
  canAttachExternal?: boolean;
  canPrint?: boolean;
  appointmentId?: string;
  patientPhone?: string | null;
}) {
  if (orders.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-surface p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-text-primary">Investigations</h4>
        {canPrint && appointmentId ? (
          <div className="flex flex-wrap gap-1.5">
            <SendPatientMessageButton appointmentId={appointmentId} patientPhone={patientPhone} compact />
            <Link href={`/appointments/${appointmentId}/investigations`} className={compactButtonClass}>
              Print
            </Link>
          </div>
        ) : null}
      </div>
      <div className="mt-2 space-y-2">
        {orders.map((order) => {
          const external = order.fulfillment === "EXTERNAL";
          const reportReady = order.status === "RESULTED" && order.reportFileName;
          return (
            <article key={order.id} className="rounded-lg border border-border/80 px-2.5 py-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${labStatusClass(order.status)}`}>
                  {prettyLabStatus(order.status)}
                </span>
                <span className="text-[11px] text-text-secondary">
                  {external ? "Outside" : inr(order.totalAmount)}
                </span>
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-1">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-full bg-app-bg px-2 py-0.5 text-[11px] font-medium text-text-primary"
                    title={item.categorySnapshot}
                  >
                    {item.nameSnapshot}
                  </li>
                ))}
              </ul>
              {reportReady && (canViewReport || (external && canAttachExternal)) ? (
                <a
                  className="mt-1.5 inline-block text-[11px] font-medium text-primary hover:underline"
                  href={`/api/lab/orders/${order.id}/report`}
                >
                  Open report
                </a>
              ) : null}
              {external && canAttachExternal && order.status !== "CANCELLED" ? (
                <ExternalReportForm
                  orderId={order.id}
                  reportFileName={order.reportFileName}
                  locked={order.status === "RESULTED"}
                />
              ) : null}
              {canCollect && !external && order.status === "AWAITING_PAYMENT" ? (
                <Link href={`/billing/lab/${order.id}`} className={`${compactPrimaryButtonClass} mt-1.5`}>
                  Collect fee
                </Link>
              ) : null}
              {canWork && !external && (order.status === "PAID" || order.status === "SAMPLE_COLLECTED") ? (
                <Link href={`/lab/${order.id}`} className={`${compactPrimaryButtonClass} mt-1.5`}>
                  Update lab
                </Link>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
