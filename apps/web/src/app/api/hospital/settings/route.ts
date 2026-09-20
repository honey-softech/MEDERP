import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { parseFollowUpReminderDaysBefore } from "@/lib/appointments/follow-up-reminder";
import { requireHospitalActor, sanitizeLogoData } from "@/lib/front-desk";

export async function PATCH(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (scoped.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hospital admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  // Branding and document policy post to this route separately, so only touch what was sent.
  const data: Prisma.HospitalUpdateInput = {};
  const brandingSent = ["address", "phone", "opdFee", "logoData", "sealData"].some((key) => key in (body ?? {}));

  if (brandingSent) {
    const opdFee = Number(body?.opdFee ?? 500);
    if (!Number.isFinite(opdFee) || opdFee < 0) {
      return NextResponse.json({ error: "Enter a valid default OPD amount." }, { status: 400 });
    }
    const logoData = sanitizeLogoData(body?.logoData);
    const sealData = sanitizeLogoData(body?.sealData);
    if (body?.logoData && !logoData) {
      return NextResponse.json({ error: "Hospital logo must be a smaller image file." }, { status: 400 });
    }
    if (body?.sealData && !sealData) {
      return NextResponse.json({ error: "Seal icon must be a smaller image file." }, { status: 400 });
    }
    data.address = String(body?.address ?? "").trim() || null;
    data.phone = String(body?.phone ?? "").trim() || null;
    data.opdFee = opdFee;
    data.logoData = logoData;
    data.sealData = sealData;
  }

  const policySent = body != null && "requireSignatureForApproval" in body;
  if (policySent) {
    data.requireSignatureForApproval = Boolean(body?.requireSignatureForApproval);
  }

  const walkInSent = body != null && ("walkInByDoctor" in body || "walkInByNurse" in body);
  if (walkInSent) {
    if ("walkInByDoctor" in body) data.walkInByDoctor = Boolean(body.walkInByDoctor);
    if ("walkInByNurse" in body) data.walkInByNurse = Boolean(body.walkInByNurse);
  }

  const nurseReceptionSent = body != null && "nurseAsReceptionist" in body;
  if (nurseReceptionSent) {
    data.nurseAsReceptionist = Boolean(body.nurseAsReceptionist);
  }

  const followUpReminderSent =
    body != null && ("followUpReminderEnabled" in body || "followUpReminderDaysBefore" in body);
  if (followUpReminderSent) {
    if ("followUpReminderEnabled" in body) {
      data.followUpReminderEnabled = Boolean(body.followUpReminderEnabled);
    }
    if ("followUpReminderDaysBefore" in body) {
      data.followUpReminderDaysBefore = parseFollowUpReminderDaysBefore(body.followUpReminderDaysBefore);
    }
  }

  if (!brandingSent && !policySent && !walkInSent && !nurseReceptionSent && !followUpReminderSent) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const existing = await prisma.hospital.findUnique({ where: { id: scoped.user.hospitalId } });
  if (!existing) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  }

  const hospital = await prisma.hospital.update({
    where: { id: scoped.user.hospitalId },
    data,
  });

  if (followUpReminderSent && data.followUpReminderEnabled === false) {
    await prisma.appointmentReminder.updateMany({
      where: { hospitalId: scoped.user.hospitalId, source: "FOLLOW_UP", status: "PENDING" },
      data: { status: "CANCELLED" },
    });
  }

  const changes = diffAuditFields(
    existing as unknown as Record<string, unknown>,
    hospital as unknown as Record<string, unknown>,
    {
      fields: [
        "address",
        "phone",
        "opdFee",
        "logoData",
        "sealData",
        "requireSignatureForApproval",
        "walkInByDoctor",
        "walkInByNurse",
        "nurseAsReceptionist",
        "followUpReminderEnabled",
        "followUpReminderDaysBefore",
      ],
    },
  );

  const followUpOnly = followUpReminderSent && !brandingSent && !policySent && !walkInSent && !nurseReceptionSent;
  const action = followUpOnly
    ? "HOSPITAL_FOLLOW_UP_REMINDER_POLICY_UPDATED"
    : nurseReceptionSent && !brandingSent && !policySent && !walkInSent
    ? "HOSPITAL_NURSE_RECEPTIONIST_POLICY_UPDATED"
    : walkInSent && !brandingSent && !policySent
    ? "HOSPITAL_WALK_IN_POLICY_UPDATED"
    : policySent && !brandingSent
      ? "HOSPITAL_SIGNATURE_POLICY_UPDATED"
      : "HOSPITAL_BRANDING_UPDATED";

  const reminderEnabled =
    data.followUpReminderEnabled ?? hospital.followUpReminderEnabled;
  const reminderDays =
    data.followUpReminderDaysBefore ?? hospital.followUpReminderDaysBefore;

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action,
    entity: "Hospital",
    entityId: hospital.id,
    summary: followUpOnly
      ? reminderEnabled
        ? `${scoped.user.username} turned on follow-up reminders ${reminderDays} day${reminderDays === 1 ? "" : "s"} before.`
        : `${scoped.user.username} turned off automatic follow-up reminders.`
      : nurseReceptionSent && !brandingSent && !policySent && !walkInSent
      ? `${scoped.user.username} ${data.nurseAsReceptionist ? "let nurses cover receptionist work." : "stopped nurses covering receptionist work."}`
      : walkInSent && !brandingSent && !policySent
      ? `${scoped.user.username} updated who can add walk-ins.`
      : policySent && !brandingSent
        ? `${scoped.user.username} ${data.requireSignatureForApproval ? "required" : "stopped requiring"} signatures for visit summary approval.`
        : `${scoped.user.username} updated hospital print branding.`,
    metadata: { changes },
  });

  return NextResponse.json({ ok: true });
}
