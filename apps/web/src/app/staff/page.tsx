import { AppShell } from "@/components/app-shell";

const staff = [
  { name: "Ananya Mehta", role: "Doctor", dept: "Cardiology", email: "dr.mehta@mederp.local" },
  { name: "Hospital Admin", role: "Admin", dept: "Administration", email: "admin@mederp.local" },
  { name: "Sneha Iyer", role: "Nurse", dept: "Cardiology", email: "sneha.iyer@mederp.local" },
];

export default function StaffPage() {
  return (
    <AppShell title="Staff">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((row) => (
              <tr key={row.email} className="border-t border-slate-100">
                <td className="px-5 py-3 font-medium">{row.name}</td>
                <td className="px-5 py-3">{row.role}</td>
                <td className="px-5 py-3">{row.dept}</td>
                <td className="px-5 py-3">{row.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
