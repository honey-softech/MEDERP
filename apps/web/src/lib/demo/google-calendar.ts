import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "./crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

const CONNECTION_ID = "default";

type BusyRow = { start?: string; end?: string };
type FreeBusyResponse = { calendars?: Record<string, { busy?: BusyRow[] }> };
type CalendarEvent = {
  id?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri?: string | null }[] };
};

function envValue(name: string) {
  const raw = process.env[name];
  if (raw == null) return "";
  return raw.trim().replace(/^["']|["']$/g, "");
}

function isLocalHost(host: string) {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "web" || h.endsWith(".local");
}

function assertPublicUrl(url: string, label: string) {
  const cleaned = url.replace(/\/$/, "");
  let host: string;
  try {
    host = new URL(cleaned).host;
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  if (isLocalHost(host)) {
    throw new Error(`${label} must be the public MedERP site (not localhost).`);
  }
  return cleaned;
}

function publicSiteBase() {
  const api = envValue("NEXT_PUBLIC_API_URL").replace(/\/$/, "");
  if (api) {
    try {
      const host = new URL(api.includes("://") ? api : `https://${api}`).host;
      if (!isLocalHost(host)) {
        return api.includes("://") ? api : `https://${api}`;
      }
    } catch {
      /* ignore */
    }
  }
  const site = envValue("SITE_ADDRESS").split(",")[0]?.trim();
  if (site && !isLocalHost(site)) {
    return site.includes("://") ? site.replace(/\/$/, "") : `https://${site}`;
  }
  return "";
}

/** Public HTTPS callback only. Ignores localhost env values. */
export function googleRedirectUri(request?: Request) {
  const PRODUCTION_CALLBACK = "https://mederp.co.in/api/platform/demos/google/callback";

  const fromEnv = envValue("GOOGLE_REDIRECT_URI");
  if (fromEnv) {
    try {
      if (!isLocalHost(new URL(fromEnv).host)) return fromEnv.replace(/\/$/, "");
    } catch {
      /* ignore bad env */
    }
  }

  const publicBase = publicSiteBase();
  if (publicBase) {
    try {
      return assertPublicUrl(`${publicBase}/api/platform/demos/google/callback`, "Demo Google redirect");
    } catch {
      /* fall through */
    }
  }

  if (request) {
    const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
      .split(",")[0]
      ?.trim();
    const protoRaw = (request.headers.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
    if (host && !isLocalHost(host)) {
      const proto = protoRaw === "http" ? "https" : protoRaw;
      try {
        return assertPublicUrl(`${proto}://${host}/api/platform/demos/google/callback`, "Demo Google redirect");
      } catch {
        /* fall through */
      }
    }
  }

  return PRODUCTION_CALLBACK;
}

export function googleConfigured() {
  return Boolean(envValue("GOOGLE_CLIENT_ID") && envValue("GOOGLE_CLIENT_SECRET"));
}

export function oauthClient(redirectUri?: string) {
  return new OAuth2Client(
    envValue("GOOGLE_CLIENT_ID"),
    envValue("GOOGLE_CLIENT_SECRET"),
    redirectUri ?? googleRedirectUri(),
  );
}

export function googleAuthUrl(state: string, request?: Request) {
  const redirectUri = googleRedirectUri(request);
  return oauthClient(redirectUri).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    redirect_uri: redirectUri,
  });
}

export async function getCalendarConnection() {
  return prisma.demoCalendarConnection.findUnique({ where: { id: CONNECTION_ID } });
}

export async function connectGoogleCalendar(code: string, userId: string, request?: Request) {
  const redirectUri = googleRedirectUri(request);
  const client = oauthClient(redirectUri);
  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
  if (!tokens.refresh_token) {
    const existing = await getCalendarConnection();
    if (!existing?.refreshTokenEnc) {
      throw new Error("Google did not return a refresh token. Disconnect the app in your Google account and connect again.");
    }
  }
  client.setCredentials(tokens);
  let googleEmail: string | null = null;
  try {
    const me = await client.request<{ email?: string }>({ url: "https://www.googleapis.com/oauth2/v2/userinfo" });
    googleEmail = me.data.email ?? null;
  } catch {
    googleEmail = null;
  }
  const existing = await getCalendarConnection();
  const refreshToken = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : existing?.refreshTokenEnc;
  if (!refreshToken) {
    throw new Error("Missing Google refresh token.");
  }
  return prisma.demoCalendarConnection.upsert({
    where: { id: CONNECTION_ID },
    update: {
      status: "CONNECTED",
      calendarId: "primary",
      googleEmail,
      refreshTokenEnc: refreshToken,
      connectedByUserId: userId,
      connectedAt: new Date(),
    },
    create: {
      id: CONNECTION_ID,
      status: "CONNECTED",
      calendarId: "primary",
      googleEmail,
      refreshTokenEnc: refreshToken,
      connectedByUserId: userId,
      connectedAt: new Date(),
    },
  });
}

export async function disconnectGoogleCalendar() {
  return prisma.demoCalendarConnection.upsert({
    where: { id: CONNECTION_ID },
    update: {
      status: "DISCONNECTED",
      refreshTokenEnc: null,
      googleEmail: null,
      connectedAt: null,
      connectedByUserId: null,
    },
    create: { id: CONNECTION_ID, status: "DISCONNECTED" },
  });
}

async function calendarApi() {
  const connection = await getCalendarConnection();
  if (!connection || connection.status !== "CONNECTED" || !connection.refreshTokenEnc) {
    throw new Error("Demo calendar is not connected.");
  }
  const client = oauthClient();
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEnc) });
  return { calendarId: connection.calendarId || "primary", client };
}

export async function freeBusy(rangeStart: Date, rangeEnd: Date, timeZone: string) {
  const { client, calendarId } = await calendarApi();
  const response = await client.request<FreeBusyResponse>({
    url: "https://www.googleapis.com/calendar/v3/freeBusy",
    method: "POST",
    data: {
      timeMin: rangeStart.toISOString(),
      timeMax: rangeEnd.toISOString(),
      timeZone,
      items: [{ id: calendarId }],
    },
  });
  const busy = response.data.calendars?.[calendarId]?.busy ?? [];
  return busy
    .filter((row) => row.start && row.end)
    .map((row) => ({ start: new Date(row.start as string), end: new Date(row.end as string) }));
}

function eventBody(params: {
  name: string;
  email: string;
  organization?: string | null;
  start: Date;
  end: Date;
  timeZone: string;
  notes?: string | null;
  meet: boolean;
}) {
  const description = [
    `Prospect: ${params.name}`,
    `Email: ${params.email}`,
    params.organization ? `Organisation: ${params.organization}` : "",
    params.notes ? `Notes: ${params.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    summary: `MedERP demo — ${params.name}`,
    description,
    start: { dateTime: params.start.toISOString(), timeZone: params.timeZone },
    end: { dateTime: params.end.toISOString(), timeZone: params.timeZone },
    attendees: [{ email: params.email }],
    ...(params.meet
      ? {
          conferenceData: {
            createRequest: {
              requestId: `mederp${params.start.getTime()}${params.email.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }
      : {}),
  };
}

async function insertEvent(
  client: OAuth2Client,
  calendarId: string,
  body: ReturnType<typeof eventBody>,
  meet: boolean,
) {
  const created = await client.request<CalendarEvent>({
    url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    method: "POST",
    params: meet ? { conferenceDataVersion: 1, sendUpdates: "all" } : { sendUpdates: "all" },
    data: body,
  });
  return created.data;
}

export async function createDemoEvent(params: {
  name: string;
  email: string;
  organization?: string | null;
  start: Date;
  end: Date;
  timeZone: string;
  notes?: string | null;
}) {
  const { client, calendarId } = await calendarApi();
  try {
    const created = await insertEvent(client, calendarId, eventBody({ ...params, meet: true }), true);
    return {
      eventId: created.id ?? null,
      meetLink: created.hangoutLink ?? created.conferenceData?.entryPoints?.find((entry) => entry.uri)?.uri ?? null,
    };
  } catch {
    const created = await insertEvent(client, calendarId, eventBody({ ...params, meet: false }), false);
    return { eventId: created.id ?? null, meetLink: null };
  }
}

export async function deleteDemoEvent(eventId: string) {
  const { client, calendarId } = await calendarApi();
  await client.request({
    url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    method: "DELETE",
    params: { sendUpdates: "all" },
  });
}
