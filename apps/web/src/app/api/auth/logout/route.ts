import { NextResponse } from "next/server";
import { clearSession, getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const user = await getCurrentUser();
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
