import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { primaryButtonClass } from "@/components/auth-shell";
import { inr, patientName, requireHospitalPage } from "@/lib/front-desk";
import { listPendingPharmacyRx, PHARMACY_BILLING_ROLES } from "@/lib/pharmacy-rx";

export default async function PharmacyPrescriptionsPage() {
  const user = await requireHospitalPage();
  if (!PHARMACY_BILLING_ROLES.includes(user.role)) redirect("/");

  const orders = await listPendingPharmacyRx(user.hospitalId);

  return (
    <AppShell title="Prescription billing">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Doctor-approved prescriptions awaiting payment. Stock is checked automatically (FEFO batch).
        </p>
        <Link href="/pharmacy" className={primaryButtonClass}>
          Inventory
        </Link>
      </div>
      <FilterableTable
        empty="No pending pharmacy bills."
        searchPlaceholder="Search patient or MRN…"
        rows={orders.map((order) => ({
          id: order.appointmentId,
          patient: order.patient,
          mrn: order.mrn,
          doctor: order.doctor,
          medicines: String(order.lines),
          inStock: `${order.inStockLines}/${order.lines}`,
          amount: inr(order.totalAmount),
          href: `/pharmacy/prescriptions/${order.appointmentId}`,
        }))}
        columns={[
          { key: "patient", header: "Patient", hrefKey: "href", className: "font-medium" },
          { key: "mrn", header: "MRN", className: "font-mono text-xs" },
          { key: "doctor", header: "Doctor" },
          { key: "medicines", header: "Medicines" },
          { key: "inStock", header: "In stock" },
          { key: "amount", header: "Bill amount" },
        ]}
      />
    </AppShell>
  );
}
