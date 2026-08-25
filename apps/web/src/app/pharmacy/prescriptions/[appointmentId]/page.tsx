import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PharmacyRxCollectForm } from "@/components/pharmacy-rx-collect-form";
import { secondaryButtonClass } from "@/components/auth-shell";
import { doctorName, inr, patientName, requireHospitalPage } from "@/lib/front-desk";
import { getPharmacyRxForAppointment, PHARMACY_BILLING_ROLES } from "@/lib/pharmacy-rx";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ appointmentId: string }> };

export default async function PharmacyPrescriptionDetailPage({ params }: Props) {
  const user = await requireHospitalPage();
  if (!PHARMACY_BILLING_ROLES.includes(user.role)) redirect("/");

  const { appointmentId } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, hospitalId: user.hospitalId },
    include: { patient: true, doctor: { include: { appUser: { select: { username: true } } } } },
  });
  if (!appointment) notFound();

  const order = await getPharmacyRxForAppointment(user.hospitalId, appointmentId);
  if (!order) {
    return (
      <AppShell title="Prescription billing">
        <p className="text-sm text-text-secondary">No pharmacy order for this visit yet.</p>
        <Link href="/pharmacy/prescriptions" className={`${secondaryButtonClass} mt-4 inline-flex`}>
          Back to queue
        </Link>
      </AppShell>
    );
  }

  if (order.status === "DISPENSED" && order.invoiceId) {
    return (
      <AppShell title="Prescription billing">
        <p className="rounded-lg border border-success/30 bg-success-bg px-4 py-3 text-sm text-success">
          Dispensed and billed. Invoice {order.invoice?.invoiceNo ?? ""} · {inr(order.totalAmount)}
        </p>
        <Link href={`/billing/${order.invoiceId}`} className={`${secondaryButtonClass} mt-4 inline-flex`}>
          View invoice
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell title="Collect pharmacy bill">
      <PharmacyRxCollectForm
        appointmentId={appointmentId}
        patientLabel={`${patientName(appointment.patient)} · ${appointment.patient.mrn}`}
        doctorLabel={doctorName(appointment.doctor)}
        initialTotal={Number(order.totalAmount)}
        initialLines={order.lines.map((line) => ({
          id: line.id,
          medicineName: line.medicineName,
          doseNotes: line.doseNotes,
          quantity: line.quantity,
          unitPrice: Number(line.unitPrice),
          lineTotal: Number(line.lineTotal),
          inStock: line.inStock,
          batch: line.batch
            ? { batchNo: line.batch.batchNo, expiryDate: line.batch.expiryDate.toISOString() }
            : null,
        }))}
      />
    </AppShell>
  );
}
