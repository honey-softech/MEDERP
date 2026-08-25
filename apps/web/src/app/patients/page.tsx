import { AppShell } from "@/components/app-shell";

const patients = [
  { mrn: "MRN-1001", name: "Rahul Sharma", age: 37, blood: "B+", phone: "+91 98765 43210" },
  { mrn: "MRN-1002", name: "Fatima Khan", age: 31, blood: "O+", phone: "+91 98111 22334" },
  { mrn: "MRN-1003", name: "Arjun Patel", age: 52, blood: "A+", phone: "+91 99000 44556" },
];

export default function PatientsPage() {
  return (
    <AppShell title="Patients">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Registration and medical record numbers</p>
        <button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">
          Register patient
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">MRN</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Age</th>
              <th className="px-5 py-3 font-medium">Blood</th>
              <th className="px-5 py-3 font-medium">Phone</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.mrn} className="border-t border-slate-100">
                <td className="px-5 py-3 font-mono text-xs">{patient.mrn}</td>
                <td className="px-5 py-3 font-medium">{patient.name}</td>
                <td className="px-5 py-3">{patient.age}</td>
                <td className="px-5 py-3">{patient.blood}</td>
                <td className="px-5 py-3">{patient.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
