import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/print-button";
import { InvestigationSlip } from "@/components/investigation-slip";
import { secondaryButtonClass } from "@/components/auth-shell";
import {
  PRINT_SUMMARY_ROLES,
  physicianLine,
  requireHospitalPage,
  tokenLabel,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { ageGenderLine } from "@/lib/visit-summary";

export default async function InvestigationSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHospitalPage();
  if (!PRINT_SUMMARY_ROLES.includes(user.role)) notFound();

  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: {
      patient: true,
      doctor: { include: { appUser: { select: { username: true } } } },
      department: true,
      hospital: { select: { name: true, address: true, phone: true, logoData: true } },
      assessment: { select: { status: true } },
      labOrders: {
        where: { status: { not: "CANCELLED" } },
        include: {
          items: true,
          orderedBySignature: { select: { imageData: true, displayName: true, credentials: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!appointment) notFound();

  // The slip is only a signed request once the doctor has approved the visit; before that
  // it is still a working list and must not carry a signature.
  const signed = appointment.assessment?.status === "APPROVED";
  const signature = signed
    ? appointment.labOrders.find((order) => order.orderedBySignature)?.orderedBySignature
    : null;

  const items = appointment.labOrders.flatMap((order) =>
    order.items.map((item) => ({
      name: item.nameSnapshot,
      category: item.categorySnapshot,
      outside: order.fulfillment === "EXTERNAL",
    })),
  );

  const printedAt = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <AppShell title="Tests / scans">
      <div className="visit-summary-frame mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 print:hidden">
        <div>
          <p className="text-sm font-semibold text-slate-900">Investigation list</p>
          <p className="mt-0.5 text-xs text-slate-500">Print for the patient. WhatsApp / SMS send will be added later.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/appointments/${appointment.id}`} className={secondaryButtonClass}>
            Back to visit
          </Link>
          <button type="button" className={secondaryButtonClass} disabled title="WhatsApp and SMS will be added later">
            Send
          </button>
          <PrintButton label="Print list" variant="primary" />
        </div>
      </div>
      <div className="visit-summary-frame">
        <InvestigationSlip
          hospitalName={appointment.hospital.name}
          hospitalAddress={appointment.hospital.address}
          hospitalPhone={appointment.hospital.phone}
          logoData={appointment.hospital.logoData}
          patientName={`${appointment.patient.firstName} ${appointment.patient.lastName}`.trim().toUpperCase()}
          mrn={appointment.patient.mrn}
          ageGender={ageGenderLine(appointment.patient.dateOfBirth, appointment.patient.gender)}
          phone={appointment.patient.phone ?? ""}
          doctor={physicianLine(appointment.doctor)}
          department={appointment.department.name}
          visitDate={appointment.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          token={tokenLabel(appointment.tokenNumber)}
          items={items}
          printedBy={user.username}
          printedAt={printedAt}
          signatureImage={signature?.imageData}
          signatureName={signature?.displayName}
          signatureCredentials={signature?.credentials}
        />
      </div>
    </AppShell>
  );
}
