import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { secondaryButtonClass } from "@/components/auth-shell";
import { BILLING_ROLES, inr, prettyEnum, requireHospitalPage } from "@/lib/front-desk";
import { loadBillingReport, monthRange, parseYearMonth, yearMonthKey } from "@/lib/billing-reports";
import { redirect } from "next/navigation";

export default async function BillingReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireHospitalPage();
  if (!BILLING_ROLES.includes(user.role)) redirect("/");
  const { month } = await searchParams;
  const selected = parseYearMonth(month);
  const { start, end } = monthRange(selected);
  const monthValue = yearMonthKey(start);
  const lastMonth = yearMonthKey(new Date(start.getFullYear(), start.getMonth() - 1, 1));
  const thisMonth = yearMonthKey(new Date());
  const report = await loadBillingReport(user.hospitalId, start, end);
  const label = start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <AppShell title="Reports">
      <p className="mb-4 text-sm text-slate-500">
        Monthly collections, refunds, and outstanding dues for {label}.
      </p>
      <form className="mb-6 flex flex-wrap items-end gap-3" action="/billing/reports">
        <label className="text-sm font-medium text-slate-700">
          Month
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="month"
            name="month"
            defaultValue={monthValue}
          />
        </label>
        <button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white" type="submit">
          View
        </button>
        <Link href={`/billing/reports?month=${thisMonth}`} className={secondaryButtonClass}>
          This month
        </Link>
        <Link href={`/billing/reports?month=${lastMonth}`} className={secondaryButtonClass}>
          Last month
        </Link>
        <a className={secondaryButtonClass} href={`/api/billing/reports?month=${monthValue}&kind=collections`}>
          Download collections CSV
        </a>
        <a className={secondaryButtonClass} href={`/api/billing/reports?month=${monthValue}&kind=dues`}>
          Download dues CSV
        </a>
      </form>

      <section className="grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Collections</p>
          <p className="mt-2 text-2xl font-semibold">{inr(report.collectedTotal)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Refunds</p>
          <p className="mt-2 text-2xl font-semibold">{inr(report.refundTotal)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Net</p>
          <p className="mt-2 text-2xl font-semibold">{inr(report.net)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Outstanding dues</p>
          <p className="mt-2 text-2xl font-semibold">{inr(report.outstanding.reduce((sum, row) => sum + row.due, 0))}</p>
        </article>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">By payment method</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {report.byMethod.map((row) => (
            <li key={row.method} className="flex justify-between text-sm">
              <span className="text-slate-600">{prettyEnum(row.method)}</span>
              <span className="font-medium">{inr(row.net)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">By doctor</h3>
        {report.doctorRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No collections credited to doctors in this month.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">Doctor</th>
                <th className="py-2">Department</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.doctorRows.map((row) => (
                <tr key={row.name} className="border-t border-slate-100">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2">{row.department}</td>
                  <td className="py-2 text-right">{inr(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8">
        <h3 className="mb-3 font-semibold">Outstanding invoices</h3>
        <FilterableTable
          empty="No outstanding dues."
          rows={report.outstanding.map((row) => ({
            id: row.id,
            invoice: row.invoiceNo,
            patient: row.patient,
            due: inr(row.due),
            status: prettyEnum(row.status),
            href: `/billing/${row.id}`,
          }))}
          columns={[
            { key: "invoice", header: "Invoice", className: "font-mono text-xs", hrefKey: "href" },
            { key: "patient", header: "Patient", className: "font-medium", hrefKey: "href" },
            { key: "due", header: "Due" },
            { key: "status", header: "Status" },
          ]}
        />
      </section>
    </AppShell>
  );
}
