import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDemoSettings, updateDemoSettings } from "@/lib/demo/settings";
import { getCalendarConnection, googleConfigured } from "@/lib/demo/google-calendar";

async function requireAdmin(request?: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== "SOFTWARE_ADMIN") return null;
  return user;
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }
  const [settings, connection] = await Promise.all([getDemoSettings(), getCalendarConnection()]);
  return NextResponse.json({
    settings,
    googleConfigured: googleConfigured(),
    connection: connection
      ? {
          status: connection.status,
          googleEmail: connection.googleEmail,
          connectedAt: connection.connectedAt,
        }
      : null,
  });
}

export async function PUT(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  try {
    const settings = await updateDemoSettings({
      durationMins: Math.trunc(Number(body.durationMins)),
      bufferMins: Math.trunc(Number(body.bufferMins)),
      timezone: String(body.timezone ?? "Asia/Kolkata").trim(),
      lookAheadDays: Math.trunc(Number(body.lookAheadDays)),
      dayStartMin: Math.trunc(Number(body.dayStartMin)),
      dayEndMin: Math.trunc(Number(body.dayEndMin)),
      notifyEmail: body.notifyEmail ? String(body.notifyEmail).trim() : null,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
