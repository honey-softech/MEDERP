import { NextResponse } from "next/server";
import { assertCanCloseHospital, closeHospital } from "@/lib/account-lifecycle";
import { consumeActionOtp } from "@/lib/action-otp";
import { writeAuditLog } from "@/lib/audit";
import { clearSession, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const allowed = await assertCanCloseHospital(user);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const otp = await consumeActionOtp(request, user, "close-hospital", "close-hospital-confirm");
  if (!otp.ok) return otp.response;

  const result = await closeHospital(user);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await writeAuditLog({
    request,
    hospitalId: result.hospital.id,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HOSPITAL_CLOSED",
    entity: "Hospital",
    entityId: result.hospital.id,
    summary: `${user.username} closed hospital ${result.hospital.code}. Staff logins were detached, the subscription was cancelled, and clinical records were kept.`,
    metadata: { detachedUsers: result.detachedUsers, subscription: result.subscription },
  });

  await clearSession();
  return NextResponse.json({ ok: true, redirectTo: "/login" });
}
