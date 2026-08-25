import { AppShell } from "@/components/app-shell";

const medicines = [
  { sku: "PARA-500", name: "Paracetamol 500mg", stock: 1200, reorder: 200, price: "₹2.50" },
  { sku: "AMOX-250", name: "Amoxicillin 250mg", stock: 80, reorder: 100, price: "₹8.00" },
];

export default function PharmacyPage() {
  return (
    <AppShell title="Pharmacy">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">SKU</th>
              <th className="px-5 py-3 font-medium">Medicine</th>
              <th className="px-5 py-3 font-medium">Stock</th>
              <th className="px-5 py-3 font-medium">Reorder at</th>
              <th className="px-5 py-3 font-medium">Unit price</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((row) => (
              <tr key={row.sku} className="border-t border-slate-100">
                <td className="px-5 py-3 font-mono text-xs">{row.sku}</td>
                <td className="px-5 py-3 font-medium">{row.name}</td>
                <td className="px-5 py-3">{row.stock}</td>
                <td className="px-5 py-3">{row.reorder}</td>
                <td className="px-5 py-3">{row.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
