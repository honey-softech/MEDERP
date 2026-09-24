import { prisma } from "@/lib/prisma";

export type Letterhead = {
  name: string;
  address?: string | null;
  phone?: string | null;
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
  if (assessment.status === "APPROVED" && assessment.issuedHospitalName) {
    return {
      name: assessment.issuedHospitalName,
      address: assessment.issuedHospitalAddress,
      phone: assessment.issuedHospitalPhone,
      code: assessment.issuedHospitalCode || live.code,
      logoData: assessment.issuedLogoData,
      sealData: assessment.issuedSealData,
    };
  }
  return live;
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
  logoData?: string | null;
  sealData?: string | null;
}) {
  return {
    issuedHospitalName: hospital.name,
    issuedHospitalCode: hospital.code,
    issuedHospitalAddress: hospital.address ?? null,
    issuedHospitalPhone: hospital.phone ?? null,
    issuedLogoData: hospital.logoData ?? null,
    issuedSealData: hospital.sealData ?? null,
  };
}

export async function billIdentityForInvoice(hospitalId: string, patientId: string) {
  const [hospital, patient] = await Promise.all([
    prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true, address: true, phone: true },
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
    issuedHospitalPhone: hospital.phone,
    issuedPatientName: patientName || null,
    issuedPatientMrn: patient.mrn,
  };
}
