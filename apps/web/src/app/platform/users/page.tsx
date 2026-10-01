import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { isRemovedAccountMobile } from "@/lib/platform-user-remove";
import { prisma } from "@/lib/prisma";

export default async function PlatformUsersPickerPage() {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") redirect("/login");

  const [hospitals, orphanRows] = await Promise.all([
    prisma.hospital.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.appUser.findMany({
      where: {
        hospitalId: null,
        role: { notIn: ["SOFTWARE_ADMIN", "HELPDESK"] },
      },
      select: { id: true, mobile: true },
    }),
  ]);

  const unassignedCount = orphanRows.filter((row) => !isRemovedAccountMobile(row.mobile)).length;

  return (
    <AppShell title="All users">
      <p className="mb-6 text-sm text-slate-500">
        Select a hospital to manage users, or open unassigned accounts (signed up but not linked to a
        hospital).
      </p>

      <Link
        href="/platform/users/unassigned"
        className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm transition hover:border-amber-400 hover:shadow-md"
      >
        <div>
          <h3 className="font-semibold text-slate-900">Unassigned accounts</h3>
          <p className="mt-1 text-sm text-slate-600">
            Registered users with no hospital yet — pending OTP or waiting to join. Remove accounts
            to free a mobile number.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-amber-800">{unassignedCount}</p>
          <p className="text-sm font-medium text-amber-800">View →</p>
        </div>
      </Link>

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
