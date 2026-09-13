import { clipWhatsAppVar } from "@/lib/messaging/templates";

/** Meta Cloud API template categories we send to patients. */
export type WhatsAppTemplateCategory = "AUTHENTICATION" | "UTILITY";

export type TextParam = { type: "text"; text: string; parameter_name?: string };
export type DocumentParam = { type: "document"; document: { link: string; filename: string } };
export type WhatsAppComponent = {
  type: string;
  sub_type?: string;
  index?: string;
  parameters: Array<TextParam | DocumentParam>;
};

export function utilityText(value: string | undefined) {
  return clipWhatsAppVar(value ?? "");
}

/** Utility login template: digits only. Do not put OTP/passcode in the Meta template body. */
export function parseOtpDigits(raw: string | undefined) {
  const otp = (raw ?? "").replace(/\D/g, "");
  if (!otp) return { error: "OTP value missing for WhatsApp send." as const };
  if (otp.length < 4 || otp.length > 8) {
    return { error: "Access number must be 4-8 digits for WhatsApp send." as const };
  }
  return { otp };
}

/** Tier 0: Meta body uses {{patientname}} / {{birthyear}}. Sent values are "Code" and the digits. */
export function utilityAccessCodeComponents(label: string, number: string): WhatsAppComponent[] {
  return [
    namedBody([
      { name: "patientname", value: label },
      { name: "birthyear", value: number },
    ]),
  ];
}

export function namedBody(params: { name: string; value: string | undefined }[]): WhatsAppComponent {
  return {
    type: "body",
    parameters: params.map((param) => ({
      type: "text",
      parameter_name: param.name,
      text: utilityText(param.value),
    })),
  };
}

export function positionalBody(texts: string[]): WhatsAppComponent {
  return {
    type: "body",
    parameters: texts.map((text) => ({ type: "text", text: utilityText(text) })),
  };
}

export function documentHeader(fileUrl: string, filename: string): WhatsAppComponent {
  return {
    type: "header",
    parameters: [
      {
        type: "document",
        document: { link: fileUrl, filename },
      },
    ],
  };
}

/** New Meta Utility templates use named vars. Set WHATSAPP_REMINDER_PARAMS=positional for older {{1}}..{{4}} templates. */
export function reminderComponents(
  vars: Record<string, string>,
  format: "named" | "positional",
): WhatsAppComponent[] {
  if (format === "positional") {
    return [
      positionalBody([
        vars.patient,
        vars.doctor,
        vars.date || vars.when,
        vars.time || vars.hospital,
      ]),
    ];
  }
  return [
    namedBody([
      { name: "patient_name", value: vars.patient },
      { name: "doctor_name", value: vars.doctor },
      { name: "appointment_date", value: vars.date || vars.when },
      { name: "appointment_time", value: vars.time },
    ]),
  ];
}

export function investigationListComponents(params: {
  vars: Record<string, string>;
  documentMediaId?: string;
  documentFilename?: string;
}): WhatsAppComponent[] | { error: string } {
  if (!params.documentMediaId) {
    return { error: "Investigation list PDF media id is missing." };
  }
  return [
    documentHeader(params.documentMediaId, params.documentFilename || "investigation-list.pdf"),
    namedBody([
      { name: "patient_name", value: params.vars.patient },
      { name: "hospital_name", value: params.vars.hospital },
      { name: "test_list", value: params.vars.items },
    ]),
  ];
}

export function billReceiptComponents(params: {
  vars: Record<string, string>;
  documentMediaId?: string;
  documentFilename?: string;
}): WhatsAppComponent[] | { error: string } {
  if (!params.documentMediaId) {
    return { error: "Bill receipt PDF media id is missing." };
  }
  return [
    documentHeader(params.documentMediaId, params.documentFilename || "bill-receipt.pdf"),
    namedBody([
      { name: "patient_name", value: params.vars.patient },
      { name: "invoice_no", value: params.vars.invoiceNo },
      { name: "hospital_name", value: params.vars.hospital },
      { name: "total_amount", value: params.vars.total },
    ]),
  ];
}

export const META_PATIENT_TEMPLATES = {
  otp: {
    category: "UTILITY" as const,
    defaultName: "as",
    defaultCodeLabel: "Code",
  },
  appointment_reminder: {
    category: "UTILITY" as const,
    defaultName: "appointment_reminder1",
  },
  bill_receipt: {
    category: "UTILITY" as const,
    defaultName: "billpreceipt",
  },
  investigation_list: {
    category: "UTILITY" as const,
    defaultName: "investigation_list",
  },
  visit_summary: {
    category: "UTILITY" as const,
    defaultName: "visit_summary",
  },
};
