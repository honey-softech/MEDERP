import { NextResponse } from "next/server";
import { loadCurrentSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
  return response;
}

export async function POST() {
  const loaded = await loadCurrentSession();
  if (!loaded) {
    return clearSessionCookie(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
  }

  const response = NextResponse.json({ ok: true, expiresAt: loaded.expiresAt.toISOString() });
  response.cookies.set(SESSION_COOKIE, loaded.token, sessionCookieOptions(loaded.expiresAt));
  return response;
}
