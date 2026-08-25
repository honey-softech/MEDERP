import Link from "next/link";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/patients", label: "Patients" },
  { href: "/appointments", label: "Appointments" },
  { href: "/staff", label: "Staff" },
  { href: "/wards", label: "Wards" },
  { href: "/pharmacy", label: "Pharmacy" },
  { href: "/lab", label: "Laboratory" },
  { href: "/billing", label: "Billing" },
];

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 w-60 border-r border-slate-200 bg-white px-4 py-6">
        <div className="mb-8 px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
            Hospital ERP
          </p>
          <h1 className="text-xl font-semibold text-slate-900">MedERP</h1>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="ml-60 min-h-screen">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
            Local development
          </span>
        </header>
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
