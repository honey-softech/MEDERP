import { prisma } from "@/lib/prisma";

export async function nextCounter(hospitalId: string, kind: string) {
  const row = await prisma.hospitalCounter.upsert({
    where: { hospitalId_kind: { hospitalId, kind } },
    create: { hospitalId, kind, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export function pad(value: number, size = 5) {
  return String(value).padStart(size, "0");
}

export async function nextMrn(hospitalId: string, hospitalCode: string) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 80; attempt++) {
    const n = await nextCounter(hospitalId, `PATIENT-${year}`);
    const mrn = `${hospitalCode}-${year}-${pad(n)}`;
    const taken = await prisma.patient.findUnique({
      where: { hospitalId_mrn: { hospitalId, mrn } },
      select: { id: true },
    });
    if (!taken) return mrn;
  }
  return `${hospitalCode}-${year}-${pad(Date.now() % 100000)}`;
}

export async function nextFamilyGroupCode(hospitalId: string, hospitalCode: string) {
  const n = await nextCounter(hospitalId, "FAMILY");
  return `FAM-${hospitalCode}-${pad(n)}`;
}

export async function nextInvoiceNo(hospitalId: string, hospitalCode: string) {
  const n = await nextCounter(hospitalId, "INVOICE");
  return `INV-${hospitalCode}-${pad(n)}`;
}

export async function nextToken(hospitalId: string, doctorId: string, at = new Date()) {
  const day = at.toISOString().slice(0, 10);
  return nextCounter(hospitalId, `TOKEN-${day}-${doctorId}`);
}
