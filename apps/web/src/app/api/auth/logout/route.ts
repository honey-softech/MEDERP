import { NextResponse } from "next/server";
import { clearSession, getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { deviceTokenFromLogoutBody } from "@/lib/device-push";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => null);
  const deviceToken = deviceTokenFromLogoutBody(body);
  if (user && deviceToken) {
    await prisma.devicePushToken.deleteMany({ where: { userId: user.id, token: deviceToken } });
  }
  // Deleting the session also drops every push token registered by this sign-in.
  await clearSession();

  if (user) {
    await writeAuditLog({
      request,
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "LOGOUT",
      entity: "AppUser",
      entityId: user.id,
      summary: `${user.username} signed out.`,
    });
  }

  return NextResponse.json({ ok: true });
}
