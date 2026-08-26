import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { secondaryButtonClass } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { countHospitalStaffSeats } from "@/lib/platform-billing";
import { staffSeatLimit } from "@/lib/platform-pricing";
import { prisma } from "@/lib/prisma";
import { HospitalSubscriptionForm } from "../hospital-subscription-form";
import { HospitalAdminPanel } from "../hospital-admin-panel";

function formatDate(value: Date) {
  return value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default async function HospitalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") redirect("/login");

  const { id } = await params;
  const hospital = await prisma.hospital.findUnique({
    where: { id },
    include: {
      users: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          mobile: true,
          email: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          sessions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, expiresAt: true },
          },
        },
      },
      platformInvoices: {
        orderBy: { issuedAt: "desc" },
        take: 10,
      },
    },
  });

  if (!hospital) notFound();

  const staffUsed = await countHospitalStaffSeats(hospital.id);
  const staffLimit = staffSeatLimit(hospital);

  return (
    <AppShell title={hospital.name}>
      <p className="mb-6 text-sm text-slate-500">
        <Link className="text-teal-700 hover:underline" href="/platform/hospitals">
          Hospital list
        </Link>
        {" · "}
        <Link className="text-teal-700 hover:underline" href={`/platform/users/${hospital.id}`}>
          Manage users
        </Link>
        {" · "}
        <Link className="text-teal-700 hover:underline" href={`/platform/audit-log/${hospital.id}`}>
          Audit log
        </Link>
      </p>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Hospital code</p>
          <p className="mt-1 font-mono font-semibold">{hospital.code}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Staff seats</p>
          <p className="mt-1 font-semibold">
            {staffUsed} / {staffLimit == null ? "∞" : staffLimit} used
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Modules</p>
          <p className="mt-1 text-sm font-semibold">
            Plan: {hospital.subscriptionTier} · Pharmacy: {hospital.pharmacyEnabled ? "Yes" : "No"} · Lab:{" "}
            {hospital.labEnabled ? "Yes" : "No"} · Inventory: {hospital.inventoryEnabled ? "Yes" : "No"}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Access</p>
          <p className={`mt-1 font-semibold ${hospital.isActive ? "text-teal-700" : "text-red-600"}`}>
            {hospital.isActive ? "Active" : "Stopped"}
          </p>
        </article>
      </section>

      <div className="mb-8">
        <HospitalAdminPanel
          hospitalId={hospital.id}
          initial={{
            name: hospital.name,
            code: hospital.code,
            address: hospital.address ?? "",
            phone: hospital.phone ?? "",
            isActive: hospital.isActive,
            opdFee: Number(hospital.opdFee),
          }}
        />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <HospitalSubscriptionForm
          hospitalId={hospital.id}
          currentTierId={hospital.subscriptionTier}
          pharmacyEnabled={hospital.pharmacyEnabled}
          labEnabled={hospital.labEnabled}
        />
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="font-semibold">Platform invoices</h4>
          {hospital.platformInvoices.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No invoices yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {hospital.platformInvoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0"
                >
                  <Link href={`/platform/invoices/${invoice.id}`} className="font-mono text-teal-700 hover:underline">
                    {invoice.invoiceNo}
                  </Link>
                  <span>{inr(Number(invoice.netTotal))}</span>
                  <span className="text-slate-500">{formatDate(invoice.issuedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Hospital users</h3>
        <Link href={`/platform/users/${hospital.id}/new`} className={secondaryButtonClass}>
          Add user
        </Link>
      </div>
      <FilterableTable
        minWidthClass="min-w-[820px]"
        empty="No users in this hospital yet."
        rows={hospital.users.map((row) => ({
          id: row.id,
          username: row.username,
          mobile: row.mobile,
          email: row.email ?? "—",
          role: row.role.replace(/_/g, " "),
          access: row.isActive ? "Active" : "Disabled",
          verified: row.isVerified ? "Yes" : "Pending OTP",
          joined: formatDate(row.createdAt),
          lastLogin: row.sessions[0] ? formatDate(row.sessions[0].createdAt) : "Never",
          edit: "Edit",
          editHref: `/platform/users/${hospital.id}/${row.id}`,
        }))}
        columns={[
          { key: "username", header: "Username", className: "font-medium" },
          { key: "mobile", header: "Mobile" },
          { key: "email", header: "Email" },
          { key: "role", header: "Role" },
          { key: "access", header: "Access" },
          { key: "verified", header: "Verified" },
          { key: "joined", header: "Joined" },
          { key: "lastLogin", header: "Last login" },
          { key: "edit", header: "", hrefKey: "editHref" },
        ]}
      />
    </AppShell>
  );
}
