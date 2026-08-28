import { AppShell } from "@/components/app-shell";
import { HospitalBrandingForm } from "@/components/hospital-branding-form";
import { SignaturePolicyForm } from "@/components/signature-policy-form";
import { requireHospitalPage } from "@/lib/front-desk";
import { countStaffWithoutSignature } from "@/lib/signatures";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function HospitalSettingsPage() {
  const user = await requireHospitalPage();
  if (user.role !== "SUPER_ADMIN") redirect("/");

  const [hospital, coverage] = await Promise.all([
    prisma.hospital.findUnique({
      where: { id: user.hospitalId },
      select: {
        name: true,
        code: true,
        address: true,
        phone: true,
        logoData: true,
        sealData: true,
        opdFee: true,
        requireSignatureForApproval: true,
      },
    }),
    countStaffWithoutSignature(user.hospitalId),
  ]);
  if (!hospital) redirect("/");

  return (
    <AppShell title="Hospital branding">
      <p className="mb-4 text-sm text-slate-500">
        Upload logos, address, and the default OPD amount used when reception records a visit payment.
      </p>
      <HospitalBrandingForm
        initial={{
          name: hospital.name,
          code: hospital.code,
          address: hospital.address ?? "",
          phone: hospital.phone ?? "",
          logoData: hospital.logoData ?? "",
          sealData: hospital.sealData ?? "",
          opdFee: String(Number(hospital.opdFee ?? 500)),
        }}
      />
      <SignaturePolicyForm
        initial={{ requireSignatureForApproval: hospital.requireSignatureForApproval }}
        coverage={coverage}
      />
    </AppShell>
  );
}
