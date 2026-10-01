import { prisma } from "@/lib/prisma";

/** True when a WhatsApp template for this appointment was already delivered. */
export async function appointmentWhatsAppSent(params: {
  hospitalId: string;
  appointmentId: string;
  templateKey: string;
}) {
  const row = await prisma.outboundMessage.findFirst({
    where: {
      hospitalId: params.hospitalId,
      appointmentId: params.appointmentId,
      templateKey: params.templateKey,
      status: "SENT",
    },
    select: { id: true },
  });
  return Boolean(row);
}

/** True when a bill receipt WhatsApp was already delivered for this invoice. */
export async function invoiceWhatsAppSent(params: {
  hospitalId: string;
  invoiceNo: string;
  appointmentId?: string | null;
}) {
  const row = await prisma.outboundMessage.findFirst({
    where: {
      hospitalId: params.hospitalId,
      templateKey: "bill_receipt",
      status: "SENT",
      OR: [
        ...(params.appointmentId ? [{ appointmentId: params.appointmentId }] : []),
        { variables: { path: ["invoiceNo"], equals: params.invoiceNo } },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

/** True when a medical certificate WhatsApp was already delivered. */
export async function certificateWhatsAppSent(params: {
  hospitalId: string;
  patientId: string;
  certificateNo: string;
}) {
  const row = await prisma.outboundMessage.findFirst({
    where: {
      hospitalId: params.hospitalId,
      patientId: params.patientId,
      templateKey: "medical_certificate",
      status: "SENT",
      variables: { path: ["certificateNo"], equals: params.certificateNo },
    },
    select: { id: true },
  });
  return Boolean(row);
}
