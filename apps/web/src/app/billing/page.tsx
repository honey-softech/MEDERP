import { AppShell } from "@/components/app-shell";

const invoices = [
  { id: "INV-2401", patient: "Rahul Sharma", total: "₹3,250", status: "Issued" },
  { id: "INV-2402", patient: "Fatima Khan", total: "₹1,180", status: "Paid" },
];

export default function BillingPage() {
  return (
    <AppShell title="Billing">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Invoice</th>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-5 py-3 font-mono text-xs">{row.id}</td>
                <td className="px-5 py-3 font-medium">{row.patient}</td>
                <td className="px-5 py-3">{row.total}</td>
                <td className="px-5 py-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
