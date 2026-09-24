import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

/**
 * Staff join requests belong to each hospital's SUPER_ADMIN (/hospital/join-requests).
 * Platform software admin should not approve hospital staff into a tenant.
 */
export default async function PlatformJoinRequestsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SOFTWARE_ADMIN") redirect("/");

  return (
    <AppShell title="Join requests">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="font-semibold text-slate-900">Handled by the hospital</p>
        <p className="mt-2 text-sm text-slate-600">
          When someone signs up and asks to join a hospital, the request goes to that hospital&apos;s{" "}
          <strong>super admin</strong> under <span className="font-medium">Administration → Join requests</span>.
          The platform software admin does not approve hospital staff joins.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          For app or login problems, use{" "}
          <Link href="/helpdesk" className="font-medium text-teal-700 hover:underline">
            Helpdesk
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
