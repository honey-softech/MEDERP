import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";
import { hospitalAccessBlocked, trialDaysRemaining } from "@/lib/hospital-access";
import { redirect } from "next/navigation";

export default async function SubscribeRequiredPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isPlatformRole(user.role)) redirect("/");
  if (!user.hospitalId) redirect("/join");
  if (user.role === "SUPER_ADMIN") redirect("/hospital/subscription");
  if (!hospitalAccessBlocked(user.hospital)) redirect("/");

  const days = trialDaysRemaining(user.hospital?.trialEndsAt);

  return (
    <AppShell title="Subscription required">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-950">The hospital trial has ended</h2>
        <p className="mt-2 text-sm text-amber-900">
          {days === 0
            ? "Ask the hospital super admin to subscribe from Subscription so the team can keep using MedERP."
            : "This hospital needs an active paid plan. Ask the super admin to open Subscription and pay."}
        </p>
        <Link href="/helpdesk" className="mt-4 inline-flex text-sm font-medium text-teal-800 hover:underline">
          Contact helpdesk →
        </Link>
      </section>
    </AppShell>
  );
}
