import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PLATFORMS = new Set(["ANDROID", "IOS"]);

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const token = String(body?.token ?? "").trim();
  const platform = String(body?.platform ?? "ANDROID").trim().toUpperCase();
  if (!token || token.length < 20 || token.length > 4096) {
    return NextResponse.json({ error: "Invalid device token." }, { status: 400 });
  }
  if (!PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Platform must be ANDROID or IOS." }, { status: 400 });
  }

  await prisma.devicePushToken.upsert({
    where: { token },
    create: { userId: user.id, token, platform },
    update: { userId: user.id, platform },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const token = String(body?.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token required." }, { status: 400 });
  }

  await prisma.devicePushToken.deleteMany({
    where: { userId: user.id, token },
  });
  return NextResponse.json({ ok: true });
}
