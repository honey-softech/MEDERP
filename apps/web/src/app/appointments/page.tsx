import { AppShell } from "@/components/app-shell";

const appointments = [
  { time: "09:00", patient: "Rahul Sharma", doctor: "Dr. Ananya Mehta", dept: "Cardiology", status: "Checked in" },
  { time: "09:20", patient: "Fatima Khan", doctor: "Dr. Vikram Rao", dept: "General Medicine", status: "Scheduled" },
  { time: "11:00", patient: "Arjun Patel", doctor: "Dr. Ananya Mehta", dept: "Cardiology", status: "Scheduled" },
];

export default function AppointmentsPage() {
  return (
    <AppShell title="Appointments">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Time</th>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Doctor</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((row) => (
              <tr key={`${row.time}-${row.patient}`} className="border-t border-slate-100">
                <td className="px-5 py-3">{row.time}</td>
                <td className="px-5 py-3 font-medium">{row.patient}</td>
                <td className="px-5 py-3">{row.doctor}</td>
                <td className="px-5 py-3">{row.dept}</td>
                <td className="px-5 py-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
