import { AppShell } from "@/components/app-shell";
import { InvoiceCreateForm } from "@/components/billing-forms";
import { BILLING_ROLES, dayRange, doctorName, patientName, requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function NewInvoicePage() {
  const user = await requireHospitalPage();
  if (!BILLING_ROLES.includes(user.role)) redirect("/");
  const { start, end } = dayRange(new Date());
  const appointments = await prisma.appointment.findMany({
    where: {
      hospitalId: user.hospitalId,
      scheduledAt: { gte: start, lt: end },
      status: { notIn: ["CANCELLED"] },
    },
    include: { patient: true, doctor: { include: { appUser: { select: { username: true } } } }, department: true },
    orderBy: { scheduledAt: "desc" },
    take: 40,
  });

  return (
    <AppShell title="Issue invoice">
      <p className="mb-4 text-sm text-slate-500">
        Link today&apos;s appointment to pull the consultation fee, or enter a custom amount.
      </p>
      <InvoiceCreateForm
        appointments={appointments.map((row) => ({
          id: row.id,
          label: `${patientName(row.patient)} · ${doctorName(row.doctor)} · ${row.department.name}`,
        }))}
      />
    </AppShell>
  );
}
