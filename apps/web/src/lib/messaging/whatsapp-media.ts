import { randomBytes, timingSafeEqual } from "crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

function env(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

type StoredDocument = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  expiresAt: number;
};

type StoredMeta = {
  filename: string;
  mimeType: string;
  expiresAt: number;
};

const memory = new Map<string, StoredDocument>();
const TTL_MS = 30 * 60 * 1000;
const ID_RE = /^[a-f0-9]{32}$/;

export type WhatsAppMediaUpload =
  | { ok: true; mediaId: string }
  | { ok: false; error: string };

function publicBaseUrl() {
  return env("WHATSAPP_MEDIA_BASE_URL", env("NEXT_PUBLIC_API_URL", "http://localhost:3000")).replace(/\/$/, "");
}

export function safePdfFilename(name: string) {
  const trimmed = name.trim() || "document.pdf";
  const cleaned = trimmed.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "") || "document.pdf";
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

/** AskEva fetches document.link from their servers. Localhost and private IPs always fail. */
export function mediaUrlError(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Bill PDF URL is invalid.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Bill PDF URL must be http or https so AskEva can download it.";
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host === "[::1]") {
    return "AskEva cannot download a PDF from localhost. Send this from the live server, or set WHATSAPP_MEDIA_BASE_URL to a public URL that serves /api/public/whatsapp-media.";
  }
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return "AskEva cannot download a PDF from a private network address. Set WHATSAPP_MEDIA_BASE_URL to a public URL.";
  }
  return null;
}

function thisAppHost() {
  try {
    return new URL(env("NEXT_PUBLIC_API_URL", "http://localhost:3000")).hostname.toLowerCase();
  } catch {
    return "localhost";
  }
}

export function shouldPublishRemote(publicUrl: string) {
  try {
    return new URL(publicUrl).hostname.toLowerCase() !== thisAppHost();
  } catch {
    return false;
  }
}

function mediaWriteKey() {
  return env("WHATSAPP_MEDIA_UPLOAD_KEY") || env("ASKEVA_API_TOKEN") || env("WHATSAPP_ACCESS_TOKEN");
}

export function isMediaWriteAuthorized(provided: string) {
  const expected = mediaWriteKey();
  if (!expected || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function resolveMediaDir() {
  const preferred = env("WHATSAPP_MEDIA_DIR") || join(process.cwd(), ".data", "whatsapp-media");
  try {
    mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = join(tmpdir(), "mederp-whatsapp-media");
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function pathsFor(id: string) {
  const dir = resolveMediaDir();
  return { pdf: join(dir, `${id}.pdf`), meta: join(dir, `${id}.json`) };
}

function pruneExpired(now = Date.now()) {
  for (const [id, row] of memory) {
    if (row.expiresAt <= now) memory.delete(id);
  }
}

function writeDocument(id: string, row: StoredDocument) {
  memory.set(id, row);
  const paths = pathsFor(id);
  writeFileSync(paths.pdf, row.buffer);
  writeFileSync(
    paths.meta,
    JSON.stringify({ filename: row.filename, mimeType: row.mimeType, expiresAt: row.expiresAt } satisfies StoredMeta),
  );
}

export function storeWhatsAppDocument(id: string, params: { buffer: Buffer; filename: string; mimeType?: string }) {
  if (!ID_RE.test(id)) return { ok: false as const, error: "Invalid media id." };
  if (params.buffer.byteLength === 0) return { ok: false as const, error: "PDF is empty." };
  if (params.buffer.byteLength > 8 * 1024 * 1024) return { ok: false as const, error: "PDF is too large." };
  pruneExpired();
  writeDocument(id, {
    buffer: params.buffer,
    filename: safePdfFilename(params.filename),
    mimeType: params.mimeType ?? "application/pdf",
    expiresAt: Date.now() + TTL_MS,
  });
  return { ok: true as const };
}

async function publishDocument(url: string, row: StoredDocument) {
  if (!shouldPublishRemote(url)) return { ok: true as const };
  const key = mediaWriteKey();
  if (!key) return { ok: false as const, error: "AskEva is not configured." };
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": row.mimeType,
        "x-mederp-media-key": key,
        "x-filename": encodeURIComponent(row.filename),
      },
      body: new Uint8Array(row.buffer),
    });
    if (response.ok) return { ok: true as const };
    if (response.status === 404 || response.status === 405) {
      return {
        ok: false as const,
        error:
          "Live server is missing the WhatsApp PDF upload API. Deploy this MedERP update to EC2, then send again from localhost.",
      };
    }
    const text = await response.text();
    return { ok: false as const, error: `Could not publish the bill PDF to the live server (${response.status}). ${text.slice(0, 140)}` };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not reach the live server to publish the bill PDF.",
    };
  }
}

function readFromDisk(id: string, now: number): StoredDocument | null {
  const paths = pathsFor(id);
  try {
    const meta = JSON.parse(readFileSync(paths.meta, "utf8")) as StoredMeta;
    if (!meta.expiresAt || meta.expiresAt <= now) {
      unlinkSync(paths.pdf);
      unlinkSync(paths.meta);
      return null;
    }
    const row: StoredDocument = {
      buffer: readFileSync(paths.pdf),
      filename: meta.filename,
      mimeType: meta.mimeType,
      expiresAt: meta.expiresAt,
    };
    memory.set(id, row);
    return row;
  } catch {
    return null;
  }
}

/** Store a PDF and return a public URL AskEva can fetch as document.link. */
export async function uploadWhatsAppDocument(params: {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
}): Promise<WhatsAppMediaUpload> {
  if (!env("ASKEVA_API_TOKEN") && !env("WHATSAPP_ACCESS_TOKEN")) {
    return { ok: false, error: "AskEva is not configured." };
  }
  const id = randomBytes(16).toString("hex");
  const url = `${publicBaseUrl()}/api/public/whatsapp-media/${id}`;
  const blocked = mediaUrlError(url);
  if (blocked) {
    return { ok: false, error: blocked };
  }
  const stored = storeWhatsAppDocument(id, params);
  if (!stored.ok) return stored;
  const published = await publishDocument(url, {
    buffer: params.buffer,
    filename: safePdfFilename(params.filename),
    mimeType: params.mimeType ?? "application/pdf",
    expiresAt: Date.now() + TTL_MS,
  });
  if (!published.ok) return published;
  return { ok: true, mediaId: url };
}

export function readWhatsAppDocument(id: string) {
  if (!ID_RE.test(id)) return null;
  pruneExpired();
  const now = Date.now();
  return memory.get(id) ?? readFromDisk(id, now);
}
