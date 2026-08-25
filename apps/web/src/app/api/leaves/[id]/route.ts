import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireHospitalActor } from "@/lib/front-desk";
import { reviewStaffLeave } from "@/lib/staff-leave";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "").toLowerCase();
  if (action !== "approve" && action !== "reject" && action !== "cancel") {
    return NextResponse.json({ error: "Use action approve, reject, or cancel." }, { status: 400 });
  }

  const result = await reviewStaffLeave({
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    leaveId: id,
    action,
    reviewNote: String(body?.reviewNote ?? "").trim() || null,
    actorRole: scoped.user.role,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: `STAFF_LEAVE_${action.toUpperCase()}`,
    entity: "StaffLeave",
    entityId: result.leave.id,
    summary: `${scoped.user.username} ${action}d leave ${result.leave.id}.`,
  });

  return NextResponse.json({ ok: true, leave: result.leave });
}
