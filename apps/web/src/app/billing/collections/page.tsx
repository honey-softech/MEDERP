import { AppShell } from "@/components/app-shell";
import { BILLING_ROLES, dayRange, doctorName, inr, localDayKey, prettyEnum, requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireHospitalPage();
  if (!BILLING_ROLES.includes(user.role)) redirect("/");
  const { date } = await searchParams;
  const selected = date ? new Date(date) : new Date();
  const { start, end } = dayRange(Number.isNaN(selected.getTime()) ? new Date() : selected);

  const payments = await prisma.payment.findMany({
    where: { hospitalId: user.hospitalId, receivedAt: { gte: start, lt: end }, kind: { not: "REFUND" } },
    include: {
      patient: true,
      invoice: {
        include: {
          appointment: {
            include: { doctor: { include: { appUser: { select: { username: true } } } }, department: true },
          },
        },
      },
    },
    orderBy: { receivedAt: "asc" },
  });

  const refunds = await prisma.payment.findMany({
    where: { hospitalId: user.hospitalId, receivedAt: { gte: start, lt: end }, kind: "REFUND" },
  });

  const collected = payments;
  const byMethod = ["CASH", "CARD", "UPI", "INSURANCE", "ADVANCE"].map((method) => {
    const inAmount = collected.filter((row) => row.method === method).reduce((sum, row) => sum + Number(row.amount), 0);
    const outAmount = refunds.filter((row) => row.method === method).reduce((sum, row) => sum + Number(row.amount), 0);
    return { method, inAmount, outAmount, net: inAmount - outAmount };
  });
  const net = byMethod.reduce((sum, row) => sum + row.net, 0);
  const cashNet = byMethod.find((row) => row.method === "CASH")?.net ?? 0;
  const cardNet = byMethod.find((row) => row.method === "CARD")?.net ?? 0;

  const byDoctor = new Map<
    string,
    { name: string; department: string; cash: number; card: number; upi: number; other: number; total: number }
  >();
  for (const row of collected) {
    const doctor = row.invoice?.appointment?.doctor;
    const key = doctor?.id ?? "unassigned";
    const name = doctor ? doctorName(doctor) : "Unassigned / other bills";
    const department = row.invoice?.appointment?.department.name ?? "—";
    const current = byDoctor.get(key) ?? { name, department, cash: 0, card: 0, upi: 0, other: 0, total: 0 };
    const amount = Number(row.amount);
    if (row.method === "CASH") current.cash += amount;
    else if (row.method === "CARD") current.card += amount;
    else if (row.method === "UPI") current.upi += amount;
    else current.other += amount;
    current.total += amount;
    byDoctor.set(key, current);
  }
  const doctorRows = [...byDoctor.values()].sort((a, b) => b.total - a.total);

  return (
    <AppShell title="Daily collections">
      <form className="mb-6 flex max-w-sm items-end gap-3" action="/billing/collections">
        <label className="text-sm font-medium text-slate-700">
          Date
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="date"
            name="date"
            defaultValue={localDayKey(start)}
          />
        </label>
        <button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white" type="submit">
          View
        </button>
      </form>

      <section className="grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Net collection</p>
          <p className="mt-2 text-2xl font-semibold">{inr(net)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Cash</p>
          <p className="mt-2 text-2xl font-semibold">{inr(cashNet)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Card</p>
          <p className="mt-2 text-2xl font-semibold">{inr(cardNet)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Transactions</p>
          <p className="mt-2 text-2xl font-semibold">{payments.length}</p>
        </article>
      </section>

      <section className="mt-8 max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Amount credited to each doctor</h3>
        <p className="mt-1 text-sm text-slate-500">Consultation collections from today&apos;s paid visits, by payment method.</p>
        {doctorRows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No doctor collections for this date.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">Doctor</th>
                <th className="py-2">Department</th>
                <th className="py-2 text-right">Cash</th>
                <th className="py-2 text-right">Card</th>
                <th className="py-2 text-right">UPI</th>
                <th className="py-2 text-right">Other</th>
                <th className="py-2 text-right">Total credited</th>
              </tr>
            </thead>
            <tbody>
              {doctorRows.map((row) => (
                <tr key={row.name} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{row.name}</td>
                  <td className="py-2 text-slate-600">{row.department}</td>
                  <td className="py-2 text-right">{inr(row.cash)}</td>
                  <td className="py-2 text-right">{inr(row.card)}</td>
                  <td className="py-2 text-right">{inr(row.upi)}</td>
                  <td className="py-2 text-right">{inr(row.other)}</td>
                  <td className="py-2 text-right font-semibold">{inr(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <table className="mt-8 w-full max-w-3xl text-sm">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-2">Method</th>
            <th className="py-2 text-right">In</th>
            <th className="py-2 text-right">Refunds</th>
            <th className="py-2 text-right">Net</th>
          </tr>
        </thead>
        <tbody>
          {byMethod.map((row) => (
            <tr key={row.method} className="border-t border-slate-100">
              <td className="py-2">{prettyEnum(row.method)}</td>
              <td className="py-2 text-right">{inr(row.inAmount)}</td>
              <td className="py-2 text-right">{inr(row.outAmount)}</td>
              <td className="py-2 text-right font-medium">{inr(row.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="mt-8 max-w-3xl space-y-2 text-sm">
        {payments.length === 0 ? (
          <li className="text-slate-500">No collections for this date.</li>
        ) : (
          payments.map((row) => (
            <li key={row.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              {row.receivedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {prettyEnum(row.method)} ·{" "}
              {inr(row.amount)} · {row.patient.firstName} {row.patient.lastName}
              {row.invoice?.appointment ? ` · ${doctorName(row.invoice.appointment.doctor)}` : ""}
              {row.notes ? ` · ${row.notes}` : ""}
            </li>
          ))
        )}
      </ul>
    </AppShell>
  );
}
