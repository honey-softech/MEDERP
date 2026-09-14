import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, sessionCookieOptions } from "@/lib/auth";
import { canUserActAsDoctor, parseViewMode, VIEW_MODE_COOKIE } from "@/lib/view-mode";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { mode?: string } | null;
  const mode = parseViewMode(body?.mode);
  if (!mode) {
    return NextResponse.json({ error: "mode must be admin or doctor." }, { status: 400 });
  }

  if (mode === "doctor" && !canUserActAsDoctor(user)) {
    return NextResponse.json(
      { error: "Set up your doctor profile under Hospital settings first." },
      { status: 403 },
    );
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const jar = await cookies();
  jar.set(VIEW_MODE_COOKIE, mode, sessionCookieOptions(expiresAt));

  return NextResponse.json({ ok: true, mode });
}
