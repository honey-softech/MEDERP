import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PharmacyGrnForm } from "@/components/pharmacy-grn-form";
import { secondaryButtonClass } from "@/components/auth-shell";
import { PHARMACY_ROLES } from "@/lib/pharmacy";
import { requireHospitalPage } from "@/lib/front-desk";

export default async function PharmacyStockInPage() {
  const user = await requireHospitalPage();
  if (!PHARMACY_ROLES.includes(user.role)) redirect("/");

  return (
    <AppShell title="Stock in (GRN)">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-text-secondary">
          Receive supplier stock manually or with a barcode scanner. Each line creates/updates a batch (FEFO-ready).
        </p>
        <Link href="/pharmacy" className={secondaryButtonClass}>
          Back to inventory
        </Link>
      </div>
      <PharmacyGrnForm />
    </AppShell>
  );
}
