import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { disconnectGoogleCalendar } from "@/lib/demo/google-calendar";

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }
  await disconnectGoogleCalendar();
  return NextResponse.json({ ok: true });
}
