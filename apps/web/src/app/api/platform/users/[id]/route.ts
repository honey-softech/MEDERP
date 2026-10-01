import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { removePlatformUser } from "@/lib/platform-user-remove";

type Ctx = { params: Promise<{ id: string }> };

/** SOFTWARE_ADMIN only — soft-remove an account (frees mobile for re-signup). */
export async function DELETE(request: Request, context: Ctx) {
  const actor = await getCurrentUser(request);
  if (!actor || actor.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await removePlatformUser({ userId: id, actorId: actor.id });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAuditLog({
    request,
    hospitalId: result.user.hospitalId,
    actorUserId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: "USER_REMOVED",
    entity: "AppUser",
    entityId: result.user.id,
    summary: `${actor.username} removed account ${result.user.username} (${result.user.mobile}).`,
    metadata: {
      previousUsername: result.user.username,
      previousMobile: result.user.mobile,
      previousHospitalId: result.user.hospitalId,
      previousRole: result.user.role,
    },
  });

  return NextResponse.json({ ok: true, id: result.user.id });
}
