import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { connectGoogleCalendar } from "@/lib/demo/google-calendar";
import { consumeOauthState } from "@/lib/demo/oauth-state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const userId = await consumeOauthState(url.searchParams.get("state"));
  if (!userId || !code) {
    return NextResponse.redirect(new URL("/platform/demos/settings?error=oauth", request.url));
  }
  const user = await prisma.appUser.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    return NextResponse.redirect(new URL("/platform/demos/settings?error=oauth", request.url));
  }
  try {
    await connectGoogleCalendar(code, user.id, request);
  } catch {
    return NextResponse.redirect(new URL("/platform/demos/settings?error=oauth", request.url));
  }
  return NextResponse.redirect(new URL("/platform/demos/settings?connected=1", request.url));
}
