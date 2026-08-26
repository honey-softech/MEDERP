import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";

export default async function PlatformUsersPickerPage() {
  const hospitals = await prisma.hospital.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <AppShell title="All users">
      <p className="mb-6 text-sm text-slate-500">
        Select a hospital to manage users, update mobile numbers, change roles, or disable access.
      </p>
      {hospitals.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No hospitals yet.{" "}
          <Link className="text-teal-700 hover:underline" href="/platform/hospitals/new">
            Create a hospital
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hospitals.map((hospital) => (
            <Link
              key={hospital.id}
              href={`/platform/users/${hospital.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-600 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{hospital.name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    hospital.isActive ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {hospital.isActive ? "Active" : "Stopped"}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">{hospital.code}</p>
              <p className="mt-3 text-sm text-slate-600">
                {hospital._count.users} user{hospital._count.users === 1 ? "" : "s"}
              </p>
              <p className="mt-3 text-sm font-medium text-teal-700">Manage users →</p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
