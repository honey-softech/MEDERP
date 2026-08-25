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
        Configure your company details and default subscription pricing for hospital registration bills.
      </p>
      <PlatformBillingSettingsForm />
    </AppShell>
  );
}
