import type { ReminderChannel } from "@prisma/client";

export type MessageTemplateKey = "appointment_reminder" | "otp" | "investigation_list";

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
  const token = variables.token ? ` Token ${variables.token}.` : "";
  return `Hi ${variables.patient ?? "patient"}, reminder for your appointment with ${variables.doctor ?? "the doctor"} at ${variables.hospital ?? "the clinic"} on ${variables.when ?? ""}.${token}`;
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
