import { AppShell } from "@/components/app-shell";

const tests = [
  { code: "CBC", name: "Complete Blood Count", price: "₹450", tat: "4 hours" },
  { code: "LFT", name: "Liver Function Test", price: "₹700", tat: "6 hours" },
  { code: "LIPID", name: "Lipid Profile", price: "₹550", tat: "6 hours" },
];

export default function LabPage() {
  return (
    <AppShell title="Laboratory">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Test</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Turnaround</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((row) => (
              <tr key={row.code} className="border-t border-slate-100">
                <td className="px-5 py-3 font-mono text-xs">{row.code}</td>
                <td className="px-5 py-3 font-medium">{row.name}</td>
                <td className="px-5 py-3">{row.price}</td>
                <td className="px-5 py-3">{row.tat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
