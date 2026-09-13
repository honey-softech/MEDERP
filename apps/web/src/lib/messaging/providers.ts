import { postAskEvaJson } from "@/lib/messaging/askeva-http";
import {
  billReceiptComponents,
  documentHeader,
  investigationListComponents,
  META_PATIENT_TEMPLATES,
  namedBody,
  parseOtpDigits,
  reminderComponents,
  utilityAccessCodeComponents,
  type WhatsAppComponent,
} from "@/lib/messaging/whatsapp-meta-templates";

export type SendResult = { ok: true; providerMessageId?: string } | { ok: false; error: string };

export type ProviderPayload = {
  toPhone: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  body: string;
  templateKey: string;
  otp?: string;
  variables?: Record<string, string>;
  /** WhatsApp media id for DOCUMENT header templates (investigation / visit summary / bill PDF). */
  documentMediaId?: string;
  documentFilename?: string;
};

export async function sendViaConsole(payload: ProviderPayload): Promise<SendResult> {
  console.info(
    `[messaging:console] ${payload.channel} ${payload.templateKey} to ******${payload.toPhone.slice(-4)}: ${payload.body}${
      payload.documentMediaId ? " [pdf attached]" : ""
    }`,
  );
  return { ok: true, providerMessageId: `console-${Date.now()}` };
}

export function digits(phone: string) {
  const raw = phone.replace(/\D/g, "");
  if (raw.length === 10) return `91${raw}`;
  return raw;
}

function env(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function askevaToken() {
  return env("ASKEVA_API_TOKEN") || env("WHATSAPP_ACCESS_TOKEN");
}

function askevaBaseUrl() {
  return env("ASKEVA_API_URL", "https://backend.askeva.io/v1").replace(/\/$/, "");
}

function whatsappConfigured() {
  return Boolean(askevaToken());
}

function templateName(key: string) {
  if (key === "otp") return env("WHATSAPP_OTP_TEMPLATE", META_PATIENT_TEMPLATES.otp.defaultName);
  if (key === "investigation_list") {
    return env("WHATSAPP_INVESTIGATION_TEMPLATE", META_PATIENT_TEMPLATES.investigation_list.defaultName);
  }
  if (key === "visit_summary") return env("WHATSAPP_VISIT_SUMMARY_TEMPLATE", META_PATIENT_TEMPLATES.visit_summary.defaultName);
  if (key === "medical_certificate") return env("WHATSAPP_MEDICAL_CERTIFICATE_TEMPLATE", "medical_certificate");
  if (key === "bill_receipt") return env("WHATSAPP_BILL_RECEIPT_TEMPLATE", META_PATIENT_TEMPLATES.bill_receipt.defaultName);
  return env("WHATSAPP_REMINDER_TEMPLATE", META_PATIENT_TEMPLATES.appointment_reminder.defaultName);
}

function reminderParamFormat(): "named" | "positional" {
  return env("WHATSAPP_REMINDER_PARAMS", "named").toLowerCase() === "positional" ? "positional" : "named";
}

function accessCodeLabel(vars: Record<string, string>) {
  return env(
    "WHATSAPP_OTP_CODE_LABEL",
    vars.patientname || vars.label || vars.code || META_PATIENT_TEMPLATES.otp.defaultCodeLabel,
  );
}

export function templateComponents(payload: ProviderPayload, _includeOtpButton = false): WhatsAppComponent[] | { error: string } {
  const vars = payload.variables ?? {};
  if (payload.templateKey === "otp") {
    const parsed = parseOtpDigits(payload.otp || vars.otp || vars.birthyear || vars.value || vars.number);
    if (parsed.error) return { error: parsed.error };
    return utilityAccessCodeComponents(accessCodeLabel(vars), parsed.otp);
  }
  if (payload.templateKey === "appointment_reminder") {
    return reminderComponents(vars, reminderParamFormat());
  }
  if (payload.templateKey === "investigation_list") {
    return investigationListComponents({
      vars,
      documentMediaId: payload.documentMediaId,
      documentFilename: payload.documentFilename,
    });
  }
  if (payload.templateKey === "visit_summary") {
    if (!payload.documentMediaId) {
      return { error: "Visit summary PDF media id is missing." };
    }
    return [
      documentHeader(payload.documentMediaId, payload.documentFilename || "visit-summary.pdf"),
      namedBody([
        { name: "patient_name", value: vars.patient },
        { name: "hospital_name", value: vars.hospital },
        { name: "doctor_name", value: vars.doctor },
        { name: "visit_when", value: vars.when },
      ]),
    ];
  }
  if (payload.templateKey === "medical_certificate") {
    if (!payload.documentMediaId) {
      return { error: "Medical certificate PDF media id is missing." };
    }
    return [
      documentHeader(payload.documentMediaId, payload.documentFilename || "medical-certificate.pdf"),
      namedBody([
        { name: "patient_name", value: vars.patient },
        { name: "hospital_name", value: vars.hospital },
        { name: "doctor_name", value: vars.doctor },
        { name: "issued_when", value: vars.when },
      ]),
    ];
  }
  if (payload.templateKey === "bill_receipt") {
    return billReceiptComponents({
      vars,
      documentMediaId: payload.documentMediaId,
      documentFilename: payload.documentFilename,
    });
  }
  return { error: `Unsupported WhatsApp template key: ${payload.templateKey}` };
}

function looksLikeAskEvaMediaFailure(text: string) {
  return /media upload|failed to (download|fetch|upload) (media|document|file)|cannot download/i.test(text);
}

function parseWhatsAppResult(text: string, httpStatus: number): SendResult {
  try {
    const json = JSON.parse(text) as {
      messages?: { id?: string }[];
      data?: { id?: string; messages?: { id?: string }[] };
      id?: string;
      messageId?: string;
      success?: boolean;
      error?: { message?: string; error_user_msg?: string } | string;
      message?: string;
    };
    const error =
      (typeof json.error === "string" ? json.error : json.error?.error_user_msg || json.error?.message) ||
      (json.success === false ? json.message : undefined);
    if (json.success === false || looksLikeAskEvaMediaFailure(text)) {
      return { ok: false, error: (error || json.message || text).slice(0, 300) };
    }
    const messageId =
      json.messages?.[0]?.id ||
      json.data?.messages?.[0]?.id ||
      json.data?.id ||
      json.messageId ||
      json.id;
    if (messageId) return { ok: true, providerMessageId: String(messageId).slice(0, 120) };
    if (httpStatus.toString().startsWith("2")) {
      return { ok: true };
    }
    if (error || json.message) return { ok: false, error: (error || json.message || "").slice(0, 300) };
  } catch {
    if (looksLikeAskEvaMediaFailure(text)) {
      return { ok: false, error: text.slice(0, 300) };
    }
  }
  if (!httpStatus.toString().startsWith("2")) {
    return { ok: false, error: text.slice(0, 300) || `WhatsApp HTTP ${httpStatus}` };
  }
  return { ok: false, error: text.slice(0, 300) || "WhatsApp send failed." };
}

async function postWhatsAppTemplate(params: {
  to: string;
  name: string;
  language: string;
  components: WhatsAppComponent[];
}): Promise<SendResult> {
  const token = askevaToken();
  if (!token) {
    return { ok: false, error: "AskEva API token is missing." };
  }
  const url = `${askevaBaseUrl()}/message/send-message?token=${encodeURIComponent(token)}`;

  try {
    const response = await postAskEvaJson(url, {
      to: params.to,
      type: "template",
      template: {
        language: { policy: "deterministic", code: params.language },
        name: params.name,
        components: params.components,
      },
    });
    const text = response.text;
    const result = parseWhatsAppResult(text, response.status);
    if (!result.ok) {
      console.error(
        `[whatsapp] template=${params.name} lang=${params.language} to=******${params.to.slice(-4)} status=${response.status} error=${result.error}`,
      );
    }
    return result;
  } catch (error) {
    return { ok: false, error: whatsappNetworkError(error) };
  }
}

function whatsappNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : "WhatsApp request failed.";
  if (/wrong final block length|ECONNRESET|ENETUNREACH|EAI_AGAIN|CERT_|SSL|OSSL|socket|TLS/i.test(message)) {
    return "Could not reach AskEva from the live server (network/TLS). Retry the send, or check that EC2 can open HTTPS to backend.askeva.io.";
  }
  return message.slice(0, 300);
}

/** Prefer English (India), then English — create the same template in both languages in Meta. */
function templateLanguages(): string[] {
  const raw = env("WHATSAPP_TEMPLATE_LANG", "en,en_IN");
  const list = raw
    .split(/[,|]+/)
    .map((code) => code.trim())
    .filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : ["en", "en_IN"];
}

function asPositionalComponents(components: WhatsAppComponent[]): WhatsAppComponent[] {
  return components.map((component) => ({
    ...component,
    parameters: component.parameters.map((parameter) =>
      parameter.type === "text" ? { type: "text", text: parameter.text } : parameter,
    ),
  }));
}

async function sendWhatsAppTemplateWithFallbacks(params: {
  to: string;
  name: string;
  components: WhatsAppComponent[];
}): Promise<SendResult> {
  const languages = templateLanguages();
  const variants = [params.components, asPositionalComponents(params.components)];
  let last: SendResult = { ok: false, error: "No WhatsApp template language configured." };
  for (const language of languages) {
    for (const components of variants) {
      last = await postWhatsAppTemplate({ ...params, language, components });
      if (last.ok) return last;
    }
  }
  return last;
}

export async function sendViaWhatsApp(payload: ProviderPayload): Promise<SendResult> {
  if (!whatsappConfigured()) {
    return sendViaConsole(payload);
  }

  const mobile = digits(payload.toPhone);
  if (mobile.length < 12) {
    return { ok: false, error: "Invalid mobile number." };
  }

  if (payload.channel === "EMAIL") {
    return sendViaConsole(payload);
  }

  const name = templateName(payload.templateKey);
  const components = templateComponents(payload);
  if ("error" in components) return { ok: false, error: components.error };
  return sendWhatsAppTemplateWithFallbacks({ to: mobile, name, components });
}

export function messagingProvider() {
  return whatsappConfigured() ? "whatsapp" : "console";
}

export async function deliverMessage(payload: ProviderPayload): Promise<SendResult> {
  if (payload.channel === "EMAIL") {
    return sendViaConsole(payload);
  }
  if (messagingProvider() === "whatsapp") {
    return sendViaWhatsApp(payload);
  }
  return sendViaConsole(payload);
}
