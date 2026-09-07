function env(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

export type WhatsAppMediaUpload =
  | { ok: true; mediaId: string }
  | { ok: false; error: string };

/** Upload a binary file to WhatsApp Cloud API; returns media id for template/message send. */
export async function uploadWhatsAppDocument(params: {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
}): Promise<WhatsAppMediaUpload> {
  const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
  const token = env("WHATSAPP_ACCESS_TOKEN");
  const version = env("WHATSAPP_GRAPH_VERSION", "v22.0");
  if (!phoneNumberId || !token) {
    return { ok: false, error: "WhatsApp is not configured." };
  }

  const mimeType = params.mimeType ?? "application/pdf";
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append(
    "file",
    new Blob([new Uint8Array(params.buffer)], { type: mimeType }),
    params.filename,
  );

  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await response.text();
    let json: { id?: string; error?: { message?: string; error_user_msg?: string } } = {};
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      // fall through
    }
    if (json.id) return { ok: true, mediaId: json.id };
    const error = json.error?.error_user_msg || json.error?.message || text.slice(0, 300);
    return { ok: false, error: error || `WhatsApp media upload HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "WhatsApp media upload failed." };
  }
}
