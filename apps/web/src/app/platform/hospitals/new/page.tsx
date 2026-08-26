import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { AddHospitalForm } from "../hospital-form";

export default async function CreateHospitalPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    redirect("/login");
  }

  return (
    <AppShell title="Create hospital">
      <p className="mb-6 text-sm text-slate-500">
        Register a hospital on a fixed monthly plan, collect payment notes, and generate a platform invoice. Seat mixes
        are flexible within each plan&apos;s limit.
      </p>
      <AddHospitalForm />
    </AppShell>
  );
}
