import type { ReminderChannel } from "@prisma/client";

export type MessageTemplateKey =
  | "appointment_reminder"
  | "otp"
  | "investigation_list"
  | "visit_summary"
  | "bill_receipt";

/** Keep WhatsApp template variables short — Meta rejects oversized bodies. */
export function clipWhatsAppVar(value: string, max = 120) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text || "-";
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function renderTemplate(
  key: MessageTemplateKey,
  variables: Record<string, string>,
): string {
  if (key === "otp") {
    return `MedERP OTP: ${variables.otp ?? ""}. Valid for 10 minutes. Do not share this code.`;
  }
  if (key === "investigation_list") {
    return `Hi ${variables.patient ?? "patient"}, ${variables.hospital ?? "the clinic"} has listed tests/scans for you: ${variables.items ?? ""}. Please follow the doctor's advice.`;
  }
  if (key === "visit_summary") {
    return `Hi ${variables.patient ?? "patient"}, your visit summary from ${variables.hospital ?? "the clinic"} with ${variables.doctor ?? "the doctor"} on ${variables.when ?? ""} is attached. Please follow the doctor's advice.`;
  }
  if (key === "bill_receipt") {
    return `Hi ${variables.patient ?? "patient"}, thank you for visiting ${variables.hospital ?? "the clinic"}. Your bill receipt ${variables.invoiceNo ?? ""} is attached as a PDF. The net total for this visit is ${variables.total ?? ""}. Please keep this receipt for your records. If you have any billing questions, contact the hospital front desk.`;
  }
  if (key === "appointment_reminder") {
    const date = variables.date || variables.when || "";
    const timeOrPlace = variables.time || variables.hospital || "";
    return `Hello ${variables.patient ?? "patient"},\n\nThis is a reminder about your upcoming appointment with ${variables.doctor ?? "the doctor"} on ${date} at ${timeOrPlace}.\n\nWe look forward to seeing you!`;
  }
  return `Hi ${variables.patient ?? "patient"}, reminder for your appointment with ${variables.doctor ?? "the doctor"} at ${variables.hospital ?? "the clinic"} on ${variables.when ?? ""}. Please arrive on time.`;
}

export function channelAllowedForPatient(
  channel: ReminderChannel,
  patient: { smsOptIn?: boolean | null; whatsappOptIn?: boolean | null } | null,
) {
  if (!patient) return true;
  if (channel === "SMS") return patient.smsOptIn !== false;
  if (channel === "WHATSAPP") return patient.whatsappOptIn !== false;
  return true;
}
