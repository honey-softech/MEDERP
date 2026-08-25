import { AppShell } from "@/components/app-shell";

const stats = [
  { label: "Patients today", value: "42" },
  { label: "Appointments", value: "18" },
  { label: "Occupied beds", value: "27 / 40" },
  { label: "Pending lab orders", value: "9" },
];

const queue = [
  { time: "09:00", name: "Rahul Sharma", dept: "Cardiology", status: "Checked in" },
  { time: "09:20", name: "Fatima Khan", dept: "General Medicine", status: "Scheduled" },
  { time: "09:40", name: "Arjun Patel", dept: "Orthopedics", status: "In progress" },
];

export default function Home() {
  return (
    <AppShell title="Dashboard">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{stat.value}</p>
          </article>
        ))}
      </section>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold">Today&apos;s appointment queue</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Time</th>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((row) => (
              <tr key={row.name} className="border-t border-slate-100">
                <td className="px-5 py-3">{row.time}</td>
                <td className="px-5 py-3 font-medium">{row.name}</td>
                <td className="px-5 py-3">{row.dept}</td>
                <td className="px-5 py-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
