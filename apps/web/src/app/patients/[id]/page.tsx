import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { FamilyLinkForm, MergePatientForm } from "@/components/patient-family-merge";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { PatientVisitHistory } from "@/components/patient-visit-history";
import { CLINICAL_VIEW_ROLES, FRONT_DESK_ROLES, LAB_REPORT_VIEW_ROLES, PRINT_SUMMARY_ROLES, WALK_IN_ROLES, ageYears, inr, patientName, prettyEnum } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { ACTIVE_ADMISSION_STATUSES, WARD_ADMIT_ROLES } from "@/lib/wards";

function dateInput(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.hospitalId) redirect("/login");
  if (!CLINICAL_VIEW_ROLES.includes(user.role) && user.role !== "ACCOUNTANT") redirect("/");
  const { id } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: {
      familyAsPrimary: { include: { relatedPatient: true } },
      mergedFrom: { select: { id: true, mrn: true, firstName: true, lastName: true } },
      mergedInto: { select: { id: true, mrn: true, firstName: true, lastName: true } },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 20,
        include: {
          doctor: { include: { appUser: { select: { username: true } } } },
          department: true,
          vitals: true,
          assessment: { select: { status: true, diagnosis: true, approvedAt: true } },
          labOrders: {
            where: { status: { not: "CANCELLED" } },
            include: { items: { select: { id: true, nameSnapshot: true } } },
          },
        },
      },
      admissions: {
        where: { status: { in: [...ACTIVE_ADMISSION_STATUSES] } },
        orderBy: { admittedAt: "desc" },
        take: 1,
        include: { bed: { include: { ward: true } } },
      },
    },
  });
  if (!patient) notFound();

  const family = patient.familyGroupId
    ? await prisma.patient.findMany({
        where: { hospitalId: user.hospitalId, familyGroupId: patient.familyGroupId, mergedIntoId: null },
        orderBy: { createdAt: "asc" },
      })
    : [patient];

  const canEdit = FRONT_DESK_ROLES.includes(user.role) && !patient.mergedIntoId;
  const canWalkIn = WALK_IN_ROLES.includes(user.role) && !patient.mergedIntoId;
  const canAdmit = WARD_ADMIT_ROLES.includes(user.role) && !patient.mergedIntoId;
  const activeStay = patient.admissions[0];
  const canPrintSummary = PRINT_SUMMARY_ROLES.includes(user.role);
  const canViewLabReports = LAB_REPORT_VIEW_ROLES.includes(user.role);
  const labReports = canViewLabReports
    ? patient.appointments.flatMap((visit) =>
        visit.labOrders.filter((order) => order.status === "RESULTED" && order.reportFileName),
      )
    : [];

  return (
    <AppShell title={patientName(patient)}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {patient.photoData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={patient.photoData} alt="" className="h-16 w-16 rounded-2xl object-cover" />
        ) : null}
        <p className="font-mono text-sm text-slate-500">{patient.mrn}</p>
        {patient.familyGroupCode ? (
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">{patient.familyGroupCode}</span>
        ) : null}
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {prettyEnum(patient.gender)} · {ageYears(patient.dateOfBirth)} yrs
        </span>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">
          Advance {inr(patient.advanceBalance)}
        </span>
        {patient.mergedInto ? (
          <Link className="text-sm text-teal-700 underline" href={`/patients/${patient.mergedInto.id}`}>
            Merged into {patientName(patient.mergedInto)}
          </Link>
        ) : null}
        {canEdit ? (
          <>
            <Link href={`/patients/${patient.id}/edit`} className={primaryButtonClass}>
              Edit details
            </Link>
            <Link href={`/appointments/new?walkin=1&patientId=${patient.id}`} className={secondaryButtonClass}>
              Add walk-in
            </Link>
            <Link href={`/appointments/new?patientId=${patient.id}`} className={secondaryButtonClass}>
              Book appointment
            </Link>
            <Link href={`/billing/new?patientId=${patient.id}`} className={secondaryButtonClass}>
              Collect fee
            </Link>
            {canAdmit && !activeStay ? (
              <Link href={`/wards/admit?patientId=${patient.id}`} className={secondaryButtonClass}>
                Admit to ward
              </Link>
            ) : null}
          </>
        ) : canWalkIn ? (
          <Link href={`/appointments/new?walkin=1&patientId=${patient.id}`} className={primaryButtonClass}>
            Add walk-in
          </Link>
        ) : null}
      </div>

      {activeStay ? (
        <section className="mb-6 max-w-5xl rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm">
          <p className="font-medium text-teal-900">Currently admitted</p>
          <p className="mt-1 text-teal-800">
            {activeStay.ipNumber} · {activeStay.bed.ward.name} {activeStay.bed.number} · {prettyEnum(activeStay.status)}
          </p>
          <Link href={`/wards/stays/${activeStay.id}`} className={`${primaryButtonClass} mt-3 inline-flex`}>
            Open stay
          </Link>
        </section>
      ) : null}

      <section className="mb-8 max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:p-6">
        <h3 className="font-semibold">Profile</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div><dt className="text-slate-500">Phone</dt><dd>{patient.phone ?? "—"}</dd></div>
          <div><dt className="text-slate-500">Address</dt><dd>{patient.address ?? "—"}</dd></div>
          <div><dt className="text-slate-500">Blood group</dt><dd>{patient.bloodGroup ?? "—"}</dd></div>
          <div><dt className="text-slate-500">Insurance</dt><dd>{patient.insuranceProvider ?? "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Allergies</dt><dd>{patient.allergies ?? "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Medical history</dt><dd>{patient.medicalHistory ?? "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Family history</dt><dd>{patient.familyHistory ?? "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Social history</dt><dd>{patient.socialHistory ?? "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Current medications</dt><dd>{patient.currentMedications ?? "—"}</dd></div>
        </dl>
      </section>

      <section className="mt-8 max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="font-semibold">Family group</h3>
        <p className="mt-1 text-sm text-slate-500">
          Children can share a parent&apos;s mobile. Each member has a unique UHID.
        </p>
        <ul className="mt-3 mb-4 space-y-1 text-sm">
          {family.map((member) => (
            <li key={member.id}>
              <Link className="text-teal-700 hover:underline" href={`/patients/${member.id}`}>
                {patientName(member)}
              </Link>
              <span className="font-mono text-slate-500"> · {member.mrn}</span>
              {member.id === patient.id ? <span className="text-teal-700"> · this patient</span> : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <>
            <h4 className="mb-3 text-sm font-medium">Register a family member under this patient</h4>
            <PatientForm
              submitLabel="Add family member"
              familyOfPatientId={patient.id}
              familyRelationDefault="CHILD"
              initial={{
                firstName: "",
                lastName: patient.lastName,
                dateOfBirth: "",
                gender: "MALE",
                phone: patient.phone ?? "",
                email: "",
                address: patient.address ?? "",
                bloodGroup: "",
                allergies: "",
                medicalHistory: "",
                familyHistory: "",
                socialHistory: "",
                currentMedications: "",
                emergencyName: patientName(patient),
                emergencyPhone: patient.phone ?? "",
                idProofType: "",
                idProofNumber: "",
                insuranceProvider: patient.insuranceProvider ?? "",
                insurancePolicyNo: patient.insurancePolicyNo ?? "",
                insuranceValidUntil: dateInput(patient.insuranceValidUntil),
                photoData: "",
              }}
            />
            <div className="mt-6">
              <h4 className="mb-3 text-sm font-medium">Or link an already registered patient</h4>
              <FamilyLinkForm patientId={patient.id} />
            </div>
          </>
        ) : null}
      </section>

      {canViewLabReports ? (
        <section className="mb-8 max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h3 className="font-semibold">Lab reports</h3>
          <p className="mt-1 text-sm text-slate-500">
            Documents from the hospital laboratory or reports brought from outside. Only the doctor and nurse can open in-house lab files.
          </p>
          {labReports.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No lab reports on this file yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {labReports.map((order) => (
                <li key={order.id}>
                  <a className="font-medium text-teal-700 hover:underline" href={`/api/lab/orders/${order.id}/report`}>
                    {order.reportFileName}
                  </a>
                  <span className="text-slate-500">
                    {" "}
                    · {order.items.map((item) => item.nameSnapshot).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <PatientVisitHistory visits={patient.appointments} canPrintSummary={canPrintSummary} canViewLabReports={canViewLabReports} />

      {canEdit ? (
        <section className="mt-8 max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
          <h3 className="font-semibold text-amber-950">Merge duplicate</h3>
          <p className="mb-4 text-sm text-amber-900">
            The selected record is closed and all visits, invoices, and payments move to this patient.
          </p>
          {patient.mergedFrom.length > 0 ? (
            <p className="mb-3 text-sm text-slate-600">
              Previously merged: {patient.mergedFrom.map((row) => `${patientName(row)} (${row.mrn})`).join(", ")}
            </p>
          ) : null}
          <MergePatientForm patientId={patient.id} />
        </section>
      ) : null}
    </AppShell>
  );
}
