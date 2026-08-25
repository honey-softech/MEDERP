import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireHospitalActor } from "@/lib/front-desk";
import {
  applyStaffLeave,
  canApplyLeave,
  canRecordLeave,
  parseLeaveType,
  parseLeaveWindow,
  recordApprovedLeave,
  staffDisplayName,
} from "@/lib/staff-leave";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const isAdmin = scoped.user.role === "SUPER_ADMIN";
  const leaves = await prisma.staffLeave.findMany({
    where: {
      hospitalId: scoped.user.hospitalId,
      ...(isAdmin ? {} : { requestedByUserId: scoped.user.id }),
    },
    include: { staff: { include: { appUser: { select: { username: true } } } } },
    orderBy: [{ status: "asc" }, { startAt: "asc" }],
    take: 200,
  });
  return NextResponse.json({ leaves });
}

export async function POST(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const body = await request.json().catch(() => null);
  const window = parseLeaveWindow(body?.startAt, body?.endAt);
  if ("error" in window) {
    return NextResponse.json({ error: window.error }, { status: 400 });
  }
  const type = parseLeaveType(body?.type);
  const reason = String(body?.reason ?? "").trim() || null;
  const record = Boolean(body?.record);
  const staffId = String(body?.staffId ?? body?.doctorId ?? "").trim();

  if (record) {
    if (!canRecordLeave(scoped.user.role)) {
      return NextResponse.json({ error: "Only reception or super admin can record leave directly." }, { status: 403 });
    }
    if (!staffId) {
      return NextResponse.json({ error: "Select a staff member." }, { status: 400 });
    }
    const result = await recordApprovedLeave({
      hospitalId: scoped.user.hospitalId,
      actor: { id: scoped.user.id, username: scoped.user.username, role: scoped.user.role },
      staffId,
      type,
      startAt: window.startAt,
      endAt: window.endAt,
      reason,
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
      action: "STAFF_LEAVE_RECORDED",
      entity: "StaffLeave",
      entityId: result.leave.id,
      summary: `${scoped.user.username} recorded leave for ${staffDisplayName(result.leave.staff)}.`,
    });
    return NextResponse.json({ ok: true, leave: result.leave });
  }

  if (!canApplyLeave(scoped.user.role)) {
    return NextResponse.json({ error: "Your role cannot apply for leave." }, { status: 403 });
  }

  const result = await applyStaffLeave({
    hospitalId: scoped.user.hospitalId,
    actor: {
      id: scoped.user.id,
      username: scoped.user.username,
      mobile: scoped.user.mobile,
      role: scoped.user.role,
    },
    type,
    startAt: window.startAt,
    endAt: window.endAt,
    reason,
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
    action: "STAFF_LEAVE_APPLIED",
    entity: "StaffLeave",
    entityId: result.leave.id,
    summary: `${scoped.user.username} applied for ${type.toLowerCase()} leave.`,
  });

  return NextResponse.json({ ok: true, leave: result.leave });
}
