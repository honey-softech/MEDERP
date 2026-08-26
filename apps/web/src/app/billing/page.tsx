import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { BILLING_ROLES, inr, patientName, prettyEnum, requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const user = await requireHospitalPage();
  if (!BILLING_ROLES.includes(user.role)) redirect("/");
  const invoices = await prisma.invoice.findMany({
    where: { hospitalId: user.hospitalId },
    include: { patient: true },
    orderBy: { issuedAt: "desc" },
    take: 80,
  });

  return (
    <AppShell title="Billing">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/billing/new" className={primaryButtonClass}>
          New invoice
        </Link>
        <Link href="/billing/advance" className={secondaryButtonClass}>
          Collect advance
        </Link>
        <Link href="/billing/collections" className={secondaryButtonClass}>
          Daily collections
        </Link>
      </div>
      <FilterableTable
        rows={invoices.map((row) => ({
          id: row.id,
          invoice: row.invoiceNo,
          patient: patientName(row.patient),
          total: inr(row.netTotal),
          paid: inr(row.paidAmount),
          status: prettyEnum(row.status),
          href: `/billing/${row.id}`,
        }))}
        empty="No invoices yet."
        columns={[
          { key: "invoice", header: "Invoice", className: "font-mono text-xs", hrefKey: "href" },
          { key: "patient", header: "Patient", className: "font-medium", hrefKey: "href" },
          { key: "total", header: "Net total" },
          { key: "paid", header: "Paid" },
          { key: "status", header: "Status" },
        ]}
      />
    </AppShell>
  );
}
