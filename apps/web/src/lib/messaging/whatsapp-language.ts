/** Patient WhatsApp languages. English keeps the existing template names. */
export const WHATSAPP_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
] as const;

export type WhatsAppLanguageCode = (typeof WHATSAPP_LANGUAGES)[number]["code"];

const ALIASES: Record<string, WhatsAppLanguageCode> = {
  en: "en",
  en_in: "en",
  english: "en",
  hi: "hi",
  hindi: "hi",
  ta: "ta",
  tamil: "ta",
  kn: "kn",
  kannada: "kn",
  ml: "ml",
  malayalam: "ml",
};

/** AskEva template names created per language. English uses the existing approved names. */
const LOCALIZED_TEMPLATE_NAMES: Record<string, Partial<Record<WhatsAppLanguageCode, string>>> = {
  appointment_reminder: {
    hi: "appointment_reminder_hi",
    ta: "appointment_reminder_ta",
    kn: "appointment_reminder_kn",
    ml: "appointment_reminder_ml",
  },
  visit_summary: {
    hi: "visit_summary_hi",
    ta: "visit_summary_ta",
    kn: "visit_summary_kn",
    ml: "visit_summary_ml",
  },
  investigation_list: {
    hi: "investigation_list_hi",
    ta: "investigation_list_ta",
    kn: "investigation_list_kn",
    ml: "investigation_list_ml",
  },
  bill_receipt: {
    hi: "billpreceipt_hi",
    ta: "billpreceipt_ta",
    kn: "billpreceipt_kn",
    ml: "billpreceipt_ml",
  },
  medical_certificate: {
    hi: "medical_certificate_hi",
    ta: "medical_certificate_ta",
    kn: "medical_certificate_kn",
    ml: "medical_certificate_ml",
  },
};

export function isPatientWhatsAppTemplate(key: string) {
  return Object.prototype.hasOwnProperty.call(LOCALIZED_TEMPLATE_NAMES, key);
}

export function normalizeWhatsAppLanguage(raw: unknown): WhatsAppLanguageCode | null {
  const text = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!text) return null;
  return ALIASES[text] ?? null;
}

/** Empty means “use the hospital language”. Any other unknown value is rejected. */
export function parsePatientWhatsAppLanguage(
  raw: unknown,
): { ok: true; value: WhatsAppLanguageCode | null } | { ok: false; error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: true, value: null };
  const code = normalizeWhatsAppLanguage(text);
  if (!code) return { ok: false, error: "Select a valid WhatsApp language." };
  return { ok: true, value: code };
}

export function parseHospitalWhatsAppLanguage(
  raw: unknown,
): { ok: true; value: WhatsAppLanguageCode } | { ok: false; error: string } {
  const parsed = parsePatientWhatsAppLanguage(raw);
  if (!parsed.ok) return parsed;
  if (!parsed.value) return { ok: false, error: "Select a WhatsApp language." };
  return { ok: true, value: parsed.value };
}

/** Patient choice wins. Otherwise the hospital default. Otherwise English. */
export function resolveWhatsAppLanguage(patientLanguage: unknown, hospitalLanguage: unknown): WhatsAppLanguageCode {
  return normalizeWhatsAppLanguage(patientLanguage) ?? normalizeWhatsAppLanguage(hospitalLanguage) ?? "en";
}

export function whatsappLanguageLabel(code: unknown) {
  const normalized = normalizeWhatsAppLanguage(code) ?? "en";
  return WHATSAPP_LANGUAGES.find((item) => item.code === normalized)?.label ?? "English";
}

export function patientWhatsAppLanguageLabel(patientLanguage: unknown, hospitalLanguage: unknown) {
  if (!normalizeWhatsAppLanguage(patientLanguage)) {
    return `Same as hospital (${whatsappLanguageLabel(hospitalLanguage)})`;
  }
  return whatsappLanguageLabel(patientLanguage);
}

export function resolveWhatsAppTemplateName(key: string, language: WhatsAppLanguageCode, englishName: string) {
  if (language === "en" || !isPatientWhatsAppTemplate(key)) return englishName;
  return LOCALIZED_TEMPLATE_NAMES[key]?.[language] ?? englishName;
}
