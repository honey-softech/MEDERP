import { AppShell } from "@/components/app-shell";

const beds = [
  { ward: "Cardio Ward A", bed: "A-101", status: "Occupied", patient: "Rahul Sharma" },
  { ward: "Cardio Ward A", bed: "A-102", status: "Available", patient: "—" },
  { ward: "Cardio Ward A", bed: "A-103", status: "Available", patient: "—" },
];

export default function WardsPage() {
  return (
    <AppShell title="Wards & beds">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Ward</th>
              <th className="px-5 py-3 font-medium">Bed</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Patient</th>
            </tr>
          </thead>
          <tbody>
            {beds.map((row) => (
              <tr key={row.bed} className="border-t border-slate-100">
                <td className="px-5 py-3">{row.ward}</td>
                <td className="px-5 py-3 font-medium">{row.bed}</td>
                <td className="px-5 py-3">{row.status}</td>
                <td className="px-5 py-3">{row.patient}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
