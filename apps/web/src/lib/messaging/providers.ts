export type SendResult = { ok: true; providerMessageId?: string } | { ok: false; error: string };

export type ProviderPayload = {
  toPhone: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  body: string;
  templateKey: string;
  otp?: string;
  variables?: Record<string, string>;
  /** WhatsApp media id for DOCUMENT header templates (visit summary / bill PDF). */
  documentMediaId?: string;
  documentFilename?: string;
};

type TextParam = { type: "text"; text: string; parameter_name?: string };
type DocumentParam = { type: "document"; document: { id: string; filename: string } };

type WhatsAppComponent = {
  type: string;
  sub_type?: string;
  index?: string;
  parameters: Array<TextParam | DocumentParam>;
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

function whatsappConfigured() {
  return Boolean(env("WHATSAPP_PHONE_NUMBER_ID") && env("WHATSAPP_ACCESS_TOKEN"));
}

function paramText(value: string | undefined) {
  const text = (value ?? "").trim();
  return text || "-";
}

/** Named body params (Meta Utility templates). OTP auth templates stay positional. */
function namedBody(params: { name: string; value: string | undefined }[]): WhatsAppComponent {
  return {
    type: "body",
    parameters: params.map((param) => ({
      type: "text",
      parameter_name: param.name,
      text: paramText(param.value),
    })),
  };
}

function positionalBody(texts: string[]): WhatsAppComponent {
  return {
    type: "body",
    parameters: texts.map((text) => ({ type: "text", text: paramText(text) })),
  };
}

function documentHeader(mediaId: string, filename: string): WhatsAppComponent {
  return {
    type: "header",
    parameters: [
      {
        type: "document",
        document: { id: mediaId, filename },
      },
    ],
  };
}

function otpCopyCodeButton(otp: string): WhatsAppComponent {
  return {
    type: "button",
    sub_type: "url",
    index: "0",
    parameters: [{ type: "text", text: paramText(otp) }],
  };
}

function templateName(key: string) {
  if (key === "otp") return env("WHATSAPP_OTP_TEMPLATE", "mederp_otp");
  if (key === "investigation_list") return env("WHATSAPP_INVESTIGATION_TEMPLATE", "investigation_list");
  if (key === "visit_summary") return env("WHATSAPP_VISIT_SUMMARY_TEMPLATE", "visit_summary");
  if (key === "bill_receipt") return env("WHATSAPP_BILL_RECEIPT_TEMPLATE", "bill_receipt");
  return env("WHATSAPP_REMINDER_TEMPLATE", "appointment_reminder");
}

export function templateComponents(payload: ProviderPayload, includeOtpButton: boolean): WhatsAppComponent[] | { error: string } {
  const vars = payload.variables ?? {};
  if (payload.templateKey === "otp") {
    const otp = payload.otp?.trim() || vars.otp?.trim();
    if (!otp) return { error: "OTP value missing for WhatsApp send." };
    const components = [positionalBody([otp])];
    if (includeOtpButton) components.push(otpCopyCodeButton(otp));
    return components;
  }
  if (payload.templateKey === "appointment_reminder") {
    // Approved Meta body (positional): Hello {{1}}, ... with {{2}} on {{3}} at {{4}}.
    return [
      positionalBody([
        vars.patient,
        vars.doctor,
        vars.date || vars.when,
        vars.time || vars.hospital,
      ]),
    ];
  }
  if (payload.templateKey === "investigation_list") {
    return [
      namedBody([
        { name: "patient_name", value: vars.patient },
        { name: "hospital_name", value: vars.hospital },
        { name: "test_list", value: vars.items },
      ]),
    ];
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
  if (payload.templateKey === "bill_receipt") {
    if (!payload.documentMediaId) {
      return { error: "Bill receipt PDF media id is missing." };
    }
    return [
      documentHeader(payload.documentMediaId, payload.documentFilename || "bill-receipt.pdf"),
      namedBody([
        { name: "patient_name", value: vars.patient },
        { name: "invoice_no", value: vars.invoiceNo },
        { name: "hospital_name", value: vars.hospital },
        { name: "total_amount", value: vars.total },
      ]),
    ];
  }
  return { error: `Unsupported WhatsApp template key: ${payload.templateKey}` };
}

function parseWhatsAppResult(text: string, httpStatus: number): SendResult {
  try {
    const json = JSON.parse(text) as {
      messages?: { id?: string }[];
      error?: { message?: string; error_user_msg?: string };
    };
    const messageId = json.messages?.[0]?.id;
    if (messageId) return { ok: true, providerMessageId: messageId.slice(0, 120) };
    const error = json.error?.error_user_msg || json.error?.message;
    if (error) return { ok: false, error: error.slice(0, 300) };
  } catch {
    // fall through
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
  const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
  const token = env("WHATSAPP_ACCESS_TOKEN");
  const version = env("WHATSAPP_GRAPH_VERSION", "v22.0");
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "template",
        template: {
          name: params.name,
          language: { code: params.language },
          components: params.components,
        },
      }),
    });
    const text = await response.text();
    const result = parseWhatsAppResult(text, response.status);
    if (!result.ok) {
      console.error(
        `[whatsapp] template=${params.name} lang=${params.language} to=******${params.to.slice(-4)} status=${response.status} error=${result.error}`,
      );
    }
    return result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "WhatsApp request failed." };
  }
}

/** Prefer English (India), then English — create the same template in both languages in Meta. */
function templateLanguages(): string[] {
  const raw = env("WHATSAPP_TEMPLATE_LANG", "en_IN,en");
  const list = raw
    .split(/[,|]+/)
    .map((code) => code.trim())
    .filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : ["en_IN", "en"];
}

function otpCopyCodeEnabled() {
  return env("WHATSAPP_OTP_COPY_CODE", "1") !== "0";
}

async function sendWhatsAppTemplateWithFallbacks(params: {
  to: string;
  name: string;
  components: WhatsAppComponent[];
}): Promise<SendResult> {
  const languages = templateLanguages();
  let last: SendResult = { ok: false, error: "No WhatsApp template language configured." };
  for (const language of languages) {
    last = await postWhatsAppTemplate({ ...params, language });
    if (last.ok) return last;
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
  const withButton = payload.templateKey === "otp" && otpCopyCodeEnabled();
  const first = templateComponents(payload, withButton);
  if ("error" in first) return { ok: false, error: first.error };

  const result = await sendWhatsAppTemplateWithFallbacks({ to: mobile, name, components: first });
  if (result.ok || !withButton) return result;

  const withoutButton = templateComponents(payload, false);
  if ("error" in withoutButton) return result;
  return sendWhatsAppTemplateWithFallbacks({ to: mobile, name, components: withoutButton });
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
