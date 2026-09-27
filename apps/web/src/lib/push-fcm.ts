import { prisma } from "@/lib/prisma";
import type { StaffNotice } from "@/lib/realtime-events";

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type CachedAccess = {
  token: string;
  expiresAt: number;
};

const g = globalThis as typeof globalThis & { mederpFcmAccess?: CachedAccess };

function serviceAccountFromEnv(): ServiceAccount | null {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    console.error("[fcm] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    return null;
  }
}

function pemPrivateKey(key: string) {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

async function getAccessToken(account: ServiceAccount): Promise<string | null> {
  if (!account.client_email || !account.private_key) return null;
  const cached = g.mederpFcmAccess;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${claim}`;

  const crypto = await import("node:crypto");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  let signature: string;
  try {
    signature = signer.sign(pemPrivateKey(account.private_key), "base64url");
  } catch (error) {
    console.error("[fcm] Failed to sign service-account JWT:", error);
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    console.error("[fcm] OAuth token error:", data.error ?? response.status);
    return null;
  }
  g.mederpFcmAccess = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in ?? 3600)) * 1000,
  };
  return data.access_token;
}

async function sendToToken(params: {
  projectId: string;
  accessToken: string;
  deviceToken: string;
  notice: StaffNotice;
}) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${params.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: params.deviceToken,
          notification: {
            title: params.notice.title,
            body: params.notice.body,
          },
          data: {
            notificationId: params.notice.id,
            href: params.notice.href ?? "",
            appointmentId: params.notice.appointmentId ?? "",
          },
          android: {
            priority: "HIGH",
            notification: {
              channelId: "mederp_alerts",
              notificationCount: 1,
            },
          },
        },
      }),
    },
  );
  if (response.ok) return { ok: true as const };
  const text = await response.text().catch(() => "");
  return { ok: false as const, status: response.status, text };
}

/** Best-effort FCM fan-out. No-op when Firebase is not configured. */
export async function sendFcmToUser(userId: string, notice: StaffNotice) {
  const account = serviceAccountFromEnv();
  const projectId = account?.project_id?.trim();
  if (!account || !projectId) return;

  const accessToken = await getAccessToken(account);
  if (!accessToken) return;

  const tokens = await prisma.devicePushToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return;

  await Promise.all(
    tokens.map(async (row) => {
      try {
        const result = await sendToToken({
          projectId,
          accessToken,
          deviceToken: row.token,
          notice,
        });
        if (result.ok) return;
        // Invalid / unregistered tokens — drop so we stop retrying.
        if (result.status === 404 || /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(result.text)) {
          await prisma.devicePushToken.delete({ where: { id: row.id } }).catch(() => null);
        } else {
          console.error(`[fcm] send failed for token ${row.id}:`, result.status, result.text.slice(0, 200));
        }
      } catch (error) {
        console.error("[fcm] send error:", error);
      }
    }),
  );
}
