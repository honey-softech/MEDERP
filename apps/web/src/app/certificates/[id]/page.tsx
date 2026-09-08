import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/print-button";
import { SendPatientMessageButton } from "@/components/send-patient-message-button";
import { VoidCertificateButton } from "@/components/void-certificate-button";
import { MedicalCertificateDocument } from "@/components/medical-certificate-document";
import { secondaryButtonClass } from "@/components/auth-shell";
import {
  DOCTOR_VISIT_ROLES,
  PRINT_SUMMARY_ROLES,
  patientName,
  requireHospitalPage,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { ageGenderLine } from "@/lib/visit-summary";

export default async function CertificatePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHospitalPage();
  const { id } = await params;
  const certificate = await prisma.medicalCertificate.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: {
      patient: true,
      hospital: {
        select: { name: true, address: true, phone: true, logoData: true, sealData: true, code: true },
      },
      issuedBySignature: { select: { imageData: true } },
    },
  });
  if (!certificate) notFound();

  const issued = certificate.status === "ISSUED";
  const canIssue = DOCTOR_VISIT_ROLES.includes(user.role);
  const canPrint = PRINT_SUMMARY_ROLES.includes(user.role);
  if (!issued && !canIssue) notFound();
  if (issued && !canPrint && !canIssue) notFound();

  const canVoid =
    issued && canIssue && (user.role === "SUPER_ADMIN" || certificate.issuedByUserId === user.id);

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
    <AppShell title="Medical certificate">
      <div className="visit-summary-frame mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 print:hidden">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {issued ? "Issued medical certificate" : "Voided medical certificate"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {issued
              ? "Doctors and reception can print this certificate for the patient."
              : certificate.voidReason
                ? `Voided: ${certificate.voidReason}`
                : "This certificate is no longer valid."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/patients/${certificate.patientId}`} className={secondaryButtonClass}>
            Patient file
          </Link>
          <Link href="/certificates" className={secondaryButtonClass}>
            All certificates
          </Link>
          {issued ? (
            <SendPatientMessageButton
              endpoint={`/api/certificates/${certificate.id}/send`}
              patientPhone={certificate.patient.phone}
              label="Send PDF on WhatsApp"
            />
          ) : null}
          {issued && canPrint ? <PrintButton label="Print certificate" variant="primary" /> : null}
          {canVoid ? <VoidCertificateButton certificateId={certificate.id} /> : null}
        </div>
      </div>
      <div className="visit-summary-frame">
        <MedicalCertificateDocument
          hospitalName={certificate.hospital.name}
          hospitalAddress={certificate.hospital.address}
          hospitalPhone={certificate.hospital.phone}
          logoData={certificate.hospital.logoData}
          sealData={certificate.hospital.sealData}
          patientName={patientName(certificate.patient)}
          mrn={certificate.patient.mrn}
          ageGender={ageGenderLine(certificate.patient.dateOfBirth, certificate.patient.gender)}
          certificateNo={certificate.certificateNo}
          type={certificate.type}
          diagnosis={certificate.diagnosis}
          remarks={certificate.remarks}
          restFrom={certificate.restFrom}
          restTo={certificate.restTo}
          fitFor={certificate.fitFor}
          purpose={certificate.purpose}
          issuedAt={certificate.issuedAt}
          dateOfBirth={certificate.patient.dateOfBirth}
          gender={certificate.patient.gender}
          printedAt={printedAt}
          voided={!issued}
          signatureImage={certificate.issuedBySignature?.imageData}
          signatureName={certificate.issuedByDisplayName || certificate.issuedByUsername}
          signatureCredentials={certificate.issuedByCredentials}
        />
      </div>
    </AppShell>
  );
}
