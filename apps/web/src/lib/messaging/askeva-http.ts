import { execFile } from "node:child_process";
import { constants } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type AskEvaHttpResult = { status: number; text: string };

const STATUS_MARKER = "__MEDERP_STATUS__:";

type TlsProfile = {
  family: 4 | 6;
  minVersion: "TLSv1.2" | "TLSv1.3";
  maxVersion?: "TLSv1.2" | "TLSv1.3";
  ciphers?: string;
};

/** Node fetch on EC2 negotiated HTTP/2 and OpenSSL then failed AskEva's handshake. */
const TLS_PROFILES: TlsProfile[] = [
  { family: 4, minVersion: "TLSv1.3", maxVersion: "TLSv1.3" },
  { family: 4, minVersion: "TLSv1.2", maxVersion: "TLSv1.2", ciphers: "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384" },
  { family: 6, minVersion: "TLSv1.2" },
];

function errorText(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause.message : "";
  return `${error.message} ${cause}`.trim();
}

export function isAskEvaTransportError(error: unknown) {
  return /wrong final block length|EPROTO|ECONNRESET|ENETUNREACH|EAI_AGAIN|ETIMEDOUT|CERT_|SSL|OSSL|socket|TLS|timed out/i.test(
    errorText(error),
  );
}

export function parseCurlOutput(stdout: string): AskEvaHttpResult {
  const index = stdout.lastIndexOf(STATUS_MARKER);
  if (index < 0) throw new Error("AskEva curl response was incomplete.");
  const status = Number(stdout.slice(index + STATUS_MARKER.length).trim());
  if (!Number.isFinite(status)) throw new Error("AskEva curl status was invalid.");
  return { status, text: stdout.slice(0, index).replace(/\n$/, "") };
}

function nodePost(url: URL, body: string, profile: TlsProfile): Promise<AskEvaHttpResult> {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(body);
    const req = https.request(
      {
        protocol: "https:",
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        family: profile.family,
        servername: url.hostname,
        minVersion: profile.minVersion,
        maxVersion: profile.maxVersion,
        ciphers: profile.ciphers,
        ALPNProtocols: ["http/1.1"],
        agent: false,
        honorCipherOrder: true,
        secureOptions: constants.SSL_OP_NO_TICKET | (constants.SSL_OP_NO_COMPRESSION ?? 0),
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.byteLength),
          Accept: "application/json",
          Connection: "close",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.setTimeout(12_000, () => {
      req.destroy(new Error("AskEva request timed out."));
    });
    req.on("error", reject);
    req.end(payload);
  });
}

function curlPost(urlString: string, body: string): Promise<AskEvaHttpResult> {
  const dir = mkdtempSync(join(tmpdir(), "askeva-"));
  const bodyPath = join(dir, "body.json").replaceAll("\\", "/");
  const configPath = join(dir, "curl.cfg");
  writeFileSync(bodyPath, body);
  writeFileSync(
    configPath,
    [
      `url = "${urlString.replaceAll('"', "")}"`,
      'request = "POST"',
      "http1.1",
      "ipv4",
      "silent",
      "show-error",
      "tlsv1.2",
      "max-time = 15",
      'header = "Content-Type: application/json"',
      'header = "Accept: application/json"',
      `data-binary = "@${bodyPath}"`,
      `write-out = "\\n${STATUS_MARKER}%{http_code}"`,
    ].join("\n"),
  );

  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      ["--config", configPath],
      { timeout: 20_000, maxBuffer: 1_000_000 },
      (error, stdout, stderr) => {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          // temp dir cleanup is best-effort
        }
        if (error && !stdout.includes(STATUS_MARKER)) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        try {
          resolve(parseCurlOutput(stdout));
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

/** HTTP/1.1. Node's default fetch/HTTP2 stack on EC2 fails the AskEva TLS handshake. */
export async function postAskEvaJson(urlString: string, body: unknown): Promise<AskEvaHttpResult> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("AskEva URL is invalid.");
  }
  const payload = JSON.stringify(body);
  let lastError: unknown;
  for (const profile of TLS_PROFILES) {
    try {
      return await nodePost(url, payload, profile);
    } catch (error) {
      lastError = error;
      if (!isAskEvaTransportError(error)) throw error;
    }
  }
  try {
    console.error(`[askeva] Node TLS failed (${errorText(lastError).slice(0, 180)}). Retrying with curl.`);
    return await curlPost(urlString, payload);
  } catch (error) {
    if (lastError instanceof Error && /ENOENT|not found/i.test(errorText(error))) throw lastError;
    throw error;
  }
}
