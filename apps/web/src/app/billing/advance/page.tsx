import { AppShell } from "@/components/app-shell";
import { AdvanceForm } from "@/components/billing-forms";
import { BILLING_ROLES, requireHospitalPage } from "@/lib/front-desk";
import { redirect } from "next/navigation";

export default async function AdvancePage() {
  const user = await requireHospitalPage();
  if (!BILLING_ROLES.includes(user.role)) redirect("/");
  return (
    <AppShell title="Advance payment">
      <p className="mb-4 text-sm text-slate-500">
        Collect an admission advance. It can later be applied to an invoice using the From advance method.
      </p>
      <AdvanceForm />
    </AppShell>
  );
}
