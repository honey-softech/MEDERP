import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { PlatformBillingSettingsForm } from "./billing-settings-form";

export default async function PlatformBillingSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SOFTWARE_ADMIN") redirect("/login");

  return (
    <AppShell title="Platform billing settings">
      <p className="mb-6 text-sm text-slate-500">
        Company details printed on every hospital subscription invoice. After a successful monthly
        Razorpay renewal, that bill is WhatsApped to the hospital SUPER_ADMIN mobile — the same
        person if the doctor is also the hospital admin.
      </p>
      <PlatformBillingSettingsForm />
    </AppShell>
  );
}
