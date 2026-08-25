import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdmissionActions } from "@/components/admission-actions";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import {
  ageYears,
  doctorName,
  inr,
  patientName,
  prettyEnum,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { statusBadge, statusBadgeBase } from "@/lib/ui";
import {
  WARD_ADMIT_ROLES,
  WARD_BILLING_ROLES,
  WARD_DISCHARGE_ADVICE_ROLES,
  WARD_TRANSFER_ROLES,
  WARD_VIEW_ROLES,
  admissionInclude,
  requireWardsPage,
  stayDays,
} from "@/lib/wards";

function stayStatusClass(status: string) {
  if (status === "ADMITTED") return statusBadge.info;
  if (status === "DISCHARGE_ADVISED") return statusBadge.warning;
  if (status === "DISCHARGED") return statusBadge.success;
  return statusBadge.neutral;
}

export default async function AdmissionStayPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireWardsPage();
  if (!WARD_VIEW_ROLES.includes(user.role)) redirect("/");
  const { id } = await params;

  const admission = await prisma.admission.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: admissionInclude,
  });
  if (!admission) notFound();

  const availableBeds = await prisma.bed.findMany({
    where: {
      hospitalId: user.hospitalId,
      isActive: true,
      status: "AVAILABLE",
      isOccupied: false,
      id: { not: admission.bedId },
      ward: { isActive: true },
    },
    orderBy: [{ ward: { name: "asc" } }, { number: "asc" }],
    include: { ward: true },
  });

  const invoice = admission.invoices.find((row) => row.status !== "VOID") ?? null;
  const days = stayDays(admission.admittedAt, admission.dischargedAt ?? new Date());
  const estimated =
    Number(admission.bed.ward.dailyRate) * days + Number(admission.bed.ward.nursingRate) * days;

  return (
    <AppShell title={admission.ipNumber}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/wards" className={secondaryButtonClass}>
          Occupancy board
        </Link>
        <Link href={`/patients/${admission.patientId}`} className={secondaryButtonClass}>
          Patient file
        </Link>
        {admission.sourceAppointmentId ? (
          <Link href={`/appointments/${admission.sourceAppointmentId}`} className={secondaryButtonClass}>
            Source visit
          </Link>
        ) : null}
        {invoice ? (
          <Link href={`/billing/${invoice.id}`} className={primaryButtonClass}>
            IPD bill {invoice.invoiceNo}
          </Link>
        ) : null}
      </div>

      <article className="max-w-5xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                {prettyEnum(admission.type)} · {admission.ipNumber}
              </p>
              <h2 className="mt-1 text-2xl font-semibold">{patientName(admission.patient)}</h2>
              <p className="font-mono text-sm text-slate-500">{admission.patient.mrn}</p>
            </div>
            <span className={`${statusBadgeBase} ${stayStatusClass(admission.status)}`}>
              {prettyEnum(admission.status)}
            </span>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Age / gender" value={`${ageYears(admission.patient.dateOfBirth)} yrs · ${prettyEnum(admission.patient.gender)}`} />
            <Item label="Ward / bed" value={`${admission.bed.ward.name} · ${admission.bed.number}`} />
            <Item label="Department" value={admission.department?.name ?? admission.bed.ward.department.name} />
            <Item
              label="Admitting doctor"
              value={admission.admittingDoctor ? doctorName(admission.admittingDoctor) : "—"}
            />
            <Item
              label="Attending doctor"
              value={admission.attendingDoctor ? doctorName(admission.attendingDoctor) : "—"}
            />
            <Item
              label="Admitted"
              value={admission.admittedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            />
            <Item label="Length of stay" value={`${days} day${days === 1 ? "" : "s"}`} />
            <Item label="Estimated bed + nursing" value={inr(estimated)} />
            <Item label="Advance on file" value={inr(admission.patient.advanceBalance)} />
            <Item
              label="Expected discharge"
              value={
                admission.expectedDischargeAt
                  ? admission.expectedDischargeAt.toLocaleDateString("en-IN", { dateStyle: "medium" })
                  : "—"
              }
            />
            <Item
              label="Discharged"
              value={
                admission.dischargedAt
                  ? `${admission.dischargedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${
                      admission.dischargeType ? ` · ${prettyEnum(admission.dischargeType)}` : ""
                    }`
                  : "—"
              }
            />
          </dl>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Diagnosis</p>
            <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm">{admission.diagnosis || "—"}</p>
          </div>
          {admission.notes || admission.dischargeNotes ? (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm">
                {admission.dischargeNotes || admission.notes}
              </p>
            </div>
          ) : null}
          {admission.attendantName ? (
            <p className="mt-3 text-sm text-slate-600">
              Attendant {admission.attendantName}
              {admission.attendantPhone ? ` · ${admission.attendantPhone}` : ""}
            </p>
          ) : null}
        </div>

        {admission.transfers.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold">Transfers</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {admission.transfers.map((row) => (
                <li key={row.id}>
                  {row.fromBed.ward.name} {row.fromBed.number} → {row.toBed.ward.name} {row.toBed.number}
                  <span className="text-slate-500">
                    {" "}
                    · {row.transferredAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    {row.reason ? ` · ${row.reason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <AdmissionActions
          admissionId={admission.id}
          status={admission.status}
          invoiceId={invoice?.id}
          availableBeds={availableBeds.map((bed) => ({
            id: bed.id,
            label: `${bed.ward.name} · ${bed.number}`,
          }))}
          canTransfer={WARD_TRANSFER_ROLES.includes(user.role)}
          canAdvise={WARD_DISCHARGE_ADVICE_ROLES.includes(user.role)}
          canDischarge={WARD_ADMIT_ROLES.includes(user.role)}
          canBill={WARD_BILLING_ROLES.includes(user.role)}
          canCancel={WARD_ADMIT_ROLES.includes(user.role)}
        />
      </article>
    </AppShell>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
