import { prisma } from "@/lib/prisma";
import { letterheadPhoneText } from "@/lib/hospital-letterhead";

export type Letterhead = {
  name: string;
  address?: string | null;
  phone?: string | null;
  altPhones?: string | null;
  code: string;
  logoData?: string | null;
  sealData?: string | null;
};

type VisitLetterheadSource = {
  status: string;
  issuedHospitalName?: string | null;
  issuedHospitalCode?: string | null;
  issuedHospitalAddress?: string | null;
  issuedHospitalPhone?: string | null;
  issuedLogoData?: string | null;
  issuedSealData?: string | null;
  approvedBySignatureImage?: string | null;
  approvedBySignature?: { imageData?: string | null } | null;
};

/** Approved summaries use the letterhead saved at approval. Drafts use the live hospital profile. */
export function visitLetterhead(assessment: VisitLetterheadSource, live: Letterhead): Letterhead {
  const phone =
    assessment.status === "APPROVED" && assessment.issuedHospitalName
      ? letterheadPhoneText(assessment.issuedHospitalPhone || live.phone, live.altPhones)
      : letterheadPhoneText(live.phone, live.altPhones);
  const address =
    assessment.status === "APPROVED" && assessment.issuedHospitalName
      ? assessment.issuedHospitalAddress || live.address
      : live.address;
  if (assessment.status === "APPROVED" && assessment.issuedHospitalName) {
    return {
      name: assessment.issuedHospitalName,
      address,
      phone,
      code: assessment.issuedHospitalCode || live.code,
      logoData: assessment.issuedLogoData,
      sealData: assessment.issuedSealData,
    };
  }
  return { ...live, address, phone };
}

/** Once a summary is approved, the signature image is the copy taken at approval. */
export function visitSignatureImage(assessment: VisitLetterheadSource) {
  if (assessment.issuedHospitalName) return assessment.approvedBySignatureImage ?? null;
  return assessment.approvedBySignature?.imageData ?? null;
}

export function visitLetterheadStamp(hospital: {
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  altPhones?: string | null;
  logoData?: string | null;
  sealData?: string | null;
}) {
  return {
    issuedHospitalName: hospital.name,
    issuedHospitalCode: hospital.code,
    issuedHospitalAddress: hospital.address ?? null,
    issuedHospitalPhone: letterheadPhoneText(hospital.phone, hospital.altPhones),
    issuedLogoData: hospital.logoData ?? null,
    issuedSealData: hospital.sealData ?? null,
  };
}

export async function billIdentityForInvoice(hospitalId: string, patientId: string) {
  const [hospital, patient] = await Promise.all([
    prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true, address: true, phone: true, altPhones: true },
    }),
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true, lastName: true, mrn: true },
    }),
  ]);
  if (!hospital || !patient) return {};
  const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  return {
    issuedHospitalName: hospital.name,
    issuedHospitalAddress: hospital.address,
    issuedHospitalPhone: letterheadPhoneText(hospital.phone, hospital.altPhones),
    issuedPatientName: patientName || null,
    issuedPatientMrn: patient.mrn,
  };
}
