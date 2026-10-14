import { NextResponse } from "next/server";
import { assertCanDeleteAccount, deleteOwnAccount } from "@/lib/account-lifecycle";
import { consumeActionOtp } from "@/lib/action-otp";
import { writeAuditLog } from "@/lib/audit";
import { clearSession, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const allowed = await assertCanDeleteAccount(user);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const otp = await consumeActionOtp(request, user, "delete-account", "delete-account-confirm");
  if (!otp.ok) return otp.response;

  const result = await deleteOwnAccount(user);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await writeAuditLog({
    request,
    hospitalId: result.user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "ACCOUNT_DELETED",
    entity: "AppUser",
    entityId: user.id,
    summary: `${user.username} deleted their account.`,
    metadata: {
      previousUsername: result.user.username,
      previousMobile: result.user.mobile,
      previousHospitalId: result.user.hospitalId,
      previousRole: result.user.role,
    },
  });

  await clearSession();
  return NextResponse.json({ ok: true, redirectTo: "/login" });
}
