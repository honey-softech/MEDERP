import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/print-button";
import { VisitSummaryDocument } from "@/components/visit-summary-document";
import { secondaryButtonClass } from "@/components/auth-shell";
import {
  DOCTOR_VISIT_ROLES,
  PRINT_SUMMARY_ROLES,
  physicianLine,
  prettyEnum,
  requireHospitalPage,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { toVitalsValues } from "@/lib/vitals";
import { ageGenderLine, encounterNumber, generalExaminationRows, visitDateLabel } from "@/lib/visit-summary";

export default async function VisitSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHospitalPage();
  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: {
      patient: true,
      doctor: { include: { appUser: { select: { username: true } } } },
      department: true,
      vitals: true,
      assessment: { include: { approvedBySignature: { select: { imageData: true } } } },
      hospital: {
        select: { name: true, address: true, phone: true, logoData: true, sealData: true, code: true },
      },
    },
  });
  if (!appointment?.assessment) notFound();

  const approved = appointment.assessment.status === "APPROVED";
  const canPreviewDraft = DOCTOR_VISIT_ROLES.includes(user.role);
  const canPrint = PRINT_SUMMARY_ROLES.includes(user.role);
  if (!approved && !canPreviewDraft) notFound();
  if (approved && !canPrint && !canPreviewDraft) notFound();

  const printedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <AppShell title="Visit summary">
      <div className="visit-summary-frame mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 print:hidden">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {approved ? "Approved visit record" : "Draft visit record"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {approved
              ? "This is the printable clinical summary. Doctors and reception can print it."
              : "Preview the printed page, then approve the assessment so reception can print it."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/appointments/${appointment.id}`} className={secondaryButtonClass}>
            Back to visit
          </Link>
          {approved || canPreviewDraft ? <PrintButton label="Print record" variant="primary" /> : null}
        </div>
      </div>
      <div className="visit-summary-frame">
      <VisitSummaryDocument
        hospitalName={appointment.hospital.name}
        hospitalAddress={appointment.hospital.address}
        hospitalPhone={appointment.hospital.phone}
        logoData={appointment.hospital.logoData}
        sealData={appointment.hospital.sealData}
        patientName={`${appointment.patient.firstName} ${appointment.patient.lastName}`.trim().toUpperCase()}
        mrn={appointment.patient.mrn}
        ageGender={ageGenderLine(appointment.patient.dateOfBirth, appointment.patient.gender)}
        encounterNo={encounterNumber(appointment.hospital.code, appointment.scheduledAt, appointment.tokenNumber)}
        appointmentType={prettyEnum(appointment.visitType)}
        visitDate={visitDateLabel(appointment.scheduledAt)}
        physician={physicianLine(appointment.doctor)}
        departmentName={appointment.department.name}
        diagnosis={appointment.assessment.diagnosis}
        chiefComplaint={appointment.assessment.chiefComplaint}
        history={appointment.assessment.summary}
        vitalsRows={generalExaminationRows(appointment.vitals ? toVitalsValues(appointment.vitals) : null)}
        systemicExamination={appointment.assessment.examination}
        advice={appointment.assessment.advice}
        followUpAt={
          appointment.assessment.followUpAt
            ? appointment.assessment.followUpAt.toLocaleDateString("en-IN", { dateStyle: "medium" })
            : null
        }
        visitOutcome={appointment.assessment.visitOutcome}
        prescription={appointment.assessment.prescription}
        printedBy={user.username}
        printedAt={printedAt}
        draft={!approved}
        signatureImage={appointment.assessment.approvedBySignature?.imageData}
        signatureName={appointment.assessment.approvedByDisplayName}
        signatureCredentials={appointment.assessment.approvedByCredentials}
      />
      </div>
    </AppShell>
  );
}
