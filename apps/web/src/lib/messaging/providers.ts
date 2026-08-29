export type SendResult = { ok: true; providerMessageId?: string } | { ok: false; error: string };

export type ProviderPayload = {
  toPhone: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  body: string;
  templateKey: string;
};

export async function sendViaConsole(payload: ProviderPayload): Promise<SendResult> {
  console.info(
    `[messaging:console] ${payload.channel} ${payload.templateKey} to ******${payload.toPhone.slice(-4)}: ${payload.body}`,
  );
  return { ok: true, providerMessageId: `console-${Date.now()}` };
}

function digits(phone: string) {
  const raw = phone.replace(/\D/g, "");
  if (raw.length === 10) return `91${raw}`;
  return raw;
}

export async function sendViaMsg91(payload: ProviderPayload): Promise<SendResult> {
  const authkey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authkey) {
    return sendViaConsole(payload);
  }

  const sender = process.env.MSG91_SENDER?.trim() || "MEDERP";
  const mobile = digits(payload.toPhone);
  if (mobile.length < 10) {
    return { ok: false, error: "Invalid mobile number." };
  }

  if (payload.channel === "EMAIL") {
    return sendViaConsole(payload);
  }

  const url = new URL("https://control.msg91.com/api/sendhttp.php");
  url.searchParams.set("authkey", authkey);
  url.searchParams.set("mobiles", mobile);
  url.searchParams.set("message", payload.body.slice(0, 1000));
  url.searchParams.set("sender", sender.slice(0, 6));
  url.searchParams.set("route", "4");
  url.searchParams.set("country", "91");

  try {
    const response = await fetch(url, { method: "GET" });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, error: text.slice(0, 300) || `MSG91 HTTP ${response.status}` };
    }
    return { ok: true, providerMessageId: text.slice(0, 80) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "MSG91 request failed." };
  }
}

export function messagingProvider() {
  return process.env.MSG91_AUTH_KEY?.trim() ? "msg91" : "console";
}

export async function deliverMessage(payload: ProviderPayload): Promise<SendResult> {
  if (messagingProvider() === "msg91") {
    return sendViaMsg91(payload);
  }
  return sendViaConsole(payload);
}
