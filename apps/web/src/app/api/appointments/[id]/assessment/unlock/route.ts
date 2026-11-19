import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth";
import {
  DOCTOR_VISIT_ROLES,
  forbidUnless,
  isHistoricalVisit,
  patientName,
  requireHospitalActor,
  staffIdForAppUser,
} from "@/lib/front-desk";
import { isActingAsDoctor, resolveViewContext } from "@/lib/view-mode";
import {
  VISIT_EDIT_REASON_MAX,
  VISIT_EDIT_REASON_MIN,
  VISIT_EDIT_UNLOCK_COOKIE,
  VISIT_EDIT_UNLOCK_FAIL_LIMIT,
  VISIT_EDIT_UNLOCK_FAIL_WINDOW_MS,
  issueVisitEditUnlock,
  visitEditUnlockCookieOptions,
} from "@/lib/appointments/visit-edit-unlock";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, DOCTOR_VISIT_ROLES);
  if (denied) return denied;
  const view = await resolveViewContext(scoped.user);
  if (!isActingAsDoctor(scoped.user, view.mode)) {
    return NextResponse.json({ error: "Switch to Doctor view to edit a past visit." }, { status: 403 });
  }

  const { id } = await context.params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: { patient: { select: { firstName: true, lastName: true } } },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }
  if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    return NextResponse.json({ error: "This visit cannot be edited." }, { status: 409 });
  }
  if (!isHistoricalVisit(appointment.scheduledAt)) {
    return NextResponse.json({ error: "Today's visit can be edited without this step." }, { status: 409 });
  }

  const myDoctorId =
    scoped.user.role === "DOCTOR"
      ? await staffIdForAppUser(scoped.user.id, scoped.user.hospitalId)
      : view.doctorStaffId;
  if (!myDoctorId || appointment.doctorId !== myDoctorId) {
    return NextResponse.json({ error: "You can only edit your own consults." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const reason = String(body?.reason ?? "").trim();
  const password = String(body?.password ?? "");
  if (reason.length < VISIT_EDIT_REASON_MIN || reason.length > VISIT_EDIT_REASON_MAX) {
    return NextResponse.json(
      { error: `Enter a reason between ${VISIT_EDIT_REASON_MIN} and ${VISIT_EDIT_REASON_MAX} characters.` },
      { status: 400 },
    );
  }
  if (!password || password.length > 200) {
    return NextResponse.json({ error: "Enter your password." }, { status: 400 });
  }

  const since = new Date(Date.now() - VISIT_EDIT_UNLOCK_FAIL_WINDOW_MS);
  const recentFailures = await prisma.auditLog.count({
    where: {
      actorUserId: scoped.user.id,
      action: "VISIT_RECORD_UNLOCK_FAILED",
      createdAt: { gte: since },
    },
  });
  if (recentFailures >= VISIT_EDIT_UNLOCK_FAIL_LIMIT) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const account = await prisma.appUser.findFirst({
    where: { id: scoped.user.id },
    select: { passwordHash: true },
  });
  const passwordOk = await verifyPassword(password, account?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!passwordOk || !account?.passwordHash) {
    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "VISIT_RECORD_UNLOCK_FAILED",
      entity: "Appointment",
      entityId: appointment.id,
      summary: `${scoped.user.username} could not unlock a past visit for ${patientName(appointment.patient)}.`,
    });
    return NextResponse.json({ error: "Password is not correct." }, { status: 401 });
  }

  const issued = issueVisitEditUnlock({
    userId: scoped.user.id,
    appointmentId: appointment.id,
    reason,
  });
  const jar = await cookies();
  jar.set(VISIT_EDIT_UNLOCK_COOKIE, issued.token, visitEditUnlockCookieOptions(issued.expiresAt));

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "VISIT_RECORD_EDIT_UNLOCKED",
    entity: "Appointment",
    entityId: appointment.id,
    summary: `${scoped.user.username} unlocked a past visit for ${patientName(appointment.patient)} to edit it. Reason: ${reason}`,
    metadata: { reason, expiresAt: issued.expiresAt.toISOString() },
  });

  return NextResponse.json({ ok: true, expiresAt: issued.expiresAt.toISOString() });
}

export async function DELETE() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const jar = await cookies();
  jar.set(VISIT_EDIT_UNLOCK_COOKIE, "", {
    ...visitEditUnlockCookieOptions(new Date(0)),
    expires: new Date(0),
  });
  return NextResponse.json({ ok: true });
}
