import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "./crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

const CONNECTION_ID = "default";

export function googleRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI?.trim()) return process.env.GOOGLE_REDIRECT_URI.trim();
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/platform/demos/google/callback`;
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri(),
  );
}

export function googleAuthUrl(state: string) {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function getCalendarConnection() {
  return prisma.demoCalendarConnection.findUnique({ where: { id: CONNECTION_ID } });
}

export async function connectGoogleCalendar(code: string, userId: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    const existing = await getCalendarConnection();
    if (!existing?.refreshTokenEnc) {
      throw new Error("Google did not return a refresh token. Disconnect the app in your Google account and connect again.");
    }
  }
  client.setCredentials(tokens);
  let googleEmail: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    googleEmail = me.data.email ?? null;
  } catch {
    googleEmail = null;
  }
  const existing = await getCalendarConnection();
  const refreshToken = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : existing?.refreshTokenEnc;
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
  return {
    calendarId: connection.calendarId || "primary",
    calendar: google.calendar({ version: "v3", auth: client }),
  };
}

export async function freeBusy(rangeStart: Date, rangeEnd: Date, timeZone: string) {
  const { calendar, calendarId } = await calendarApi();
  const response = await calendar.freebusy.query({
    requestBody: {
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

export async function createDemoEvent(params: {
  name: string;
  email: string;
  organization?: string | null;
  start: Date;
  end: Date;
  timeZone: string;
  notes?: string | null;
}) {
  const { calendar, calendarId } = await calendarApi();
    const requestId = `mederp${params.start.getTime()}${params.email.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;
  const description = [
    `Prospect: ${params.name}`,
    `Email: ${params.email}`,
    params.organization ? `Organisation: ${params.organization}` : "",
    params.notes ? `Notes: ${params.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const created = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "none",
      requestBody: {
        summary: `MedERP demo — ${params.name}`,
        description,
        start: { dateTime: params.start.toISOString(), timeZone: params.timeZone },
        end: { dateTime: params.end.toISOString(), timeZone: params.timeZone },
        attendees: [{ email: params.email }],
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });
    return {
      eventId: created.data.id ?? null,
      meetLink: created.data.hangoutLink ?? created.data.conferenceData?.entryPoints?.find((entry) => entry.uri)?.uri ?? null,
    };
  } catch {
    const created = await calendar.events.insert({
      calendarId,
      sendUpdates: "none",
      requestBody: {
        summary: `MedERP demo — ${params.name}`,
        description,
        start: { dateTime: params.start.toISOString(), timeZone: params.timeZone },
        end: { dateTime: params.end.toISOString(), timeZone: params.timeZone },
        attendees: [{ email: params.email }],
      },
    });
    return { eventId: created.data.id ?? null, meetLink: null };
  }
}

export async function deleteDemoEvent(eventId: string) {
  const { calendar, calendarId } = await calendarApi();
  await calendar.events.delete({ calendarId, eventId, sendUpdates: "none" });
}
