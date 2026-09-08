import { SignatureBlock } from "@/components/signature-block";
import { certificateLetter, certificateTitle, formatCertDate } from "@/lib/medical-certificates";
import type { MedicalCertificateType } from "@prisma/client";

export function MedicalCertificateDocument({
  hospitalName,
  hospitalAddress,
  hospitalPhone,
  logoData,
  sealData,
  patientName,
  mrn,
  ageGender,
  certificateNo,
  type,
  diagnosis,
  remarks,
  restFrom,
  restTo,
  fitFor,
  purpose,
  issuedAt,
  dateOfBirth,
  gender,
  printedAt,
  voided,
  signatureImage,
  signatureName,
  signatureCredentials,
}: {
  hospitalName: string;
  hospitalAddress?: string | null;
  hospitalPhone?: string | null;
  logoData?: string | null;
  sealData?: string | null;
  patientName: string;
  mrn: string;
  ageGender: string;
  certificateNo: string;
  type: MedicalCertificateType;
  diagnosis: string;
  remarks?: string | null;
  restFrom?: Date | null;
  restTo?: Date | null;
  fitFor?: string | null;
  purpose?: string | null;
  issuedAt: Date;
  dateOfBirth: Date;
  gender: string;
  printedAt: string;
  voided?: boolean;
  signatureImage?: string | null;
  signatureName?: string | null;
  signatureCredentials?: string | null;
}) {
  const letter = certificateLetter({
    type,
    patientName,
    mrn,
    dateOfBirth,
    gender,
    diagnosis,
    remarks,
    restFrom,
    restTo,
    fitFor,
    purpose,
    issuedAt,
  });

  return (
    <article className="visit-summary-print">
      <div className="vs-sheet">
        {voided ? <p className="vs-draft">Voided — this certificate is no longer valid</p> : null}

        <header className="vs-letterhead">
          <div className="vs-letterhead-left">
            {sealData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sealData} alt="" className="vs-mark" />
            ) : (
              <div className="vs-mark vs-mark-fallback" aria-hidden>
                +
              </div>
            )}
          </div>
          <div className="vs-letterhead-center">
            <p className="vs-hospital">{hospitalName}</p>
            {hospitalAddress ? <p className="vs-meta">{hospitalAddress}</p> : null}
            {hospitalPhone ? <p className="vs-meta">{hospitalPhone}</p> : null}
          </div>
          <div className="vs-letterhead-right">
            {logoData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoData} alt={hospitalName} className="vs-logo" />
            ) : null}
          </div>
        </header>

        <h1 className="vs-title">{certificateTitle(type)}</h1>

        <section className="vs-identity">
          <div className="vs-identity-main">
            <p className="vs-patient-name">{patientName}</p>
            <p className="vs-patient-age">{ageGender}</p>
          </div>
          <div className="vs-identity-ids">
            <p className="vs-field">
              <span className="vs-label">Certificate no.</span>
              <span className="vs-mono">{certificateNo}</span>
            </p>
            <p className="vs-field">
              <span className="vs-label">UHID</span>
              <span className="vs-mono">{mrn}</span>
            </p>
          </div>
          <div className="vs-identity-meta">
            <p className="vs-field">
              <span className="vs-label">Issued</span>
              <span>{formatCertDate(issuedAt)}</span>
            </p>
          </div>
        </section>

        <div className="vs-clinical">
          <div className="vs-row">
            <p className="vs-row-label">Certificate</p>
            <div className="vs-row-body">
              <p className="vs-body whitespace-pre-wrap">{letter}</p>
            </div>
          </div>
        </div>

        <section className="vs-signoff">
          <div className="vs-signoff-spacer" />
          <SignatureBlock
            role=""
            name={signatureName || "Attending physician"}
            credentials={signatureCredentials}
            imageData={voided ? null : signatureImage}
          />
        </section>
      </div>

      <footer className="vs-footer">
        <p className="vs-confidential">
          This document contains confidential information about your health. It is provided directly
          to you for your personal use only.
        </p>
        <p className="vs-eoe">E &amp; OE</p>
        <div className="vs-footer-meta">
          <span>Page 1/1</span>
          <span>Printed on: {printedAt}</span>
        </div>
      </footer>
    </article>
  );
}
