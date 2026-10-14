import { NextResponse } from "next/server";
import { assertCanLeaveHospital, leaveHospital } from "@/lib/account-lifecycle";
import { consumeActionOtp } from "@/lib/action-otp";
import { writeAuditLog } from "@/lib/audit";
import { clearSession, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const allowed = await assertCanLeaveHospital(user);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const otp = await consumeActionOtp(request, user, "leave-hospital", "leave-hospital-confirm");
  if (!otp.ok) return otp.response;

  const result = await leaveHospital(user);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await writeAuditLog({
    request,
    hospitalId: result.hospital.id,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "USER_LEFT_HOSPITAL",
    entity: "AppUser",
    entityId: user.id,
    summary: `${user.username} left hospital ${result.hospital.code}.`,
  });

  await clearSession();
  return NextResponse.json({ ok: true, redirectTo: "/login" });
}
