import type { AppRole, LeaveStatus, LeaveType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/auth";
import { notifyHospitalRole, notifyUser } from "@/lib/notifications";

const LEAVE_TYPES: LeaveType[] = ["CASUAL", "SICK", "EARNED", "EMERGENCY", "OTHER"];

export function canApplyLeave(role: AppRole) {
  return STAFF_ROLES.includes(role);
}

export function canReviewLeave(role: AppRole) {
  return role === "SUPER_ADMIN";
}

export function canRecordLeave(role: AppRole) {
  return role === "SUPER_ADMIN" || role === "RECEPTIONIST";
}

export function parseLeaveType(value: unknown): LeaveType {
  const type = String(value ?? "CASUAL").toUpperCase() as LeaveType;
  return LEAVE_TYPES.includes(type) ? type : "CASUAL";
}

export function staffDisplayName(staff: {
  firstName: string;
  lastName: string;
  role: string;
  appUser?: { username: string } | null;
}) {
  const full = `${staff.firstName} ${staff.lastName}`.trim();
  if (full) {
    if (staff.role === "DOCTOR" && !/^dr/i.test(full)) return `Dr. ${full}`;
    return full;
  }
  return staff.appUser?.username ?? "Staff";
}

function staffRoleForAppRole(role: AppRole): UserRole | null {
  if (role === "DOCTOR") return "DOCTOR";
  if (role === "NURSE") return "NURSE";
  if (role === "RECEPTIONIST") return "RECEPTIONIST";
  if (role === "PHARMACIST") return "PHARMACIST";
  if (role === "LAB_TECH") return "LAB_TECH";
  if (role === "ACCOUNTANT") return "ACCOUNTANT";
  return null;
}

export async function ensureStaffForUser(params: {
  hospitalId: string;
  appUserId: string;
  username: string;
  mobile: string;
  role: AppRole;
}) {
  const existing = await prisma.staff.findUnique({ where: { appUserId: params.appUserId } });
  if (existing) return existing;
  const staffRole = staffRoleForAppRole(params.role);
  if (!staffRole) return null;

  const parts = params.username.replace(/[._]/g, " ").split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? params.username;
  const lastName = parts.slice(1).join(" ");
  const email = `${params.username.toLowerCase()}@hospital.local`;

  return prisma.staff.create({
    data: {
      hospitalId: params.hospitalId,
      appUserId: params.appUserId,
      email: `${params.hospitalId.slice(-6)}.${email}`,
      firstName,
      lastName,
      role: staffRole,
      phone: params.mobile,
    },
  });
}

export function parseLeaveWindow(startRaw: unknown, endRaw: unknown) {
  const startStr = String(startRaw ?? "").trim();
  const endStr = String(endRaw ?? "").trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

  if (dateOnly.test(startStr) && dateOnly.test(endStr)) {
    const startAt = new Date(`${startStr}T00:00:00`);
    const endAt = new Date(`${endStr}T00:00:00`);
    endAt.setDate(endAt.getDate() + 1);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      return { error: "Leave must have a valid start and end date." };
    }
    return { startAt, endAt };
  }

  const startAt = new Date(startStr);
  const endAt = new Date(endStr);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return { error: "Leave must have a valid start and end." };
  }
  return { startAt, endAt };
}

function localDayBounds(at: Date) {
  const start = new Date(at);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function overlappingLeave(params: {
  staffId: string;
  startAt: Date;
  endAt: Date;
  statuses: LeaveStatus[];
  excludeId?: string;
}) {
  return prisma.staffLeave.findFirst({
    where: {
      staffId: params.staffId,
      status: { in: params.statuses },
      startAt: { lt: params.endAt },
      endAt: { gt: params.startAt },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
  });
}

/** True if pending or approved leave overlaps the local calendar day of `at`. Rejected leave does not block. */
export async function staffIsOnApprovedLeave(hospitalId: string, staffId: string, at: Date) {
  const { start, end } = localDayBounds(at);
  const leave = await prisma.staffLeave.findFirst({
    where: {
      hospitalId,
      staffId,
      status: { in: ["PENDING", "APPROVED"] },
      startAt: { lt: end },
      endAt: { gt: start },
    },
    select: { id: true },
  });
  return Boolean(leave);
}

export async function staffIdsOnApprovedLeave(hospitalId: string, staffIds: string[], at: Date) {
  if (staffIds.length === 0) return [];
  const { start, end } = localDayBounds(at);
  const rows = await prisma.staffLeave.findMany({
    where: {
      hospitalId,
      staffId: { in: staffIds },
      status: { in: ["PENDING", "APPROVED"] },
      startAt: { lt: end },
      endAt: { gt: start },
    },
    select: { staffId: true },
  });
  return [...new Set(rows.map((row) => row.staffId))];
}

export async function applyStaffLeave(params: {
  hospitalId: string;
  actor: { id: string; username: string; mobile: string; role: AppRole };
  type: LeaveType;
  startAt: Date;
  endAt: Date;
  reason?: string | null;
}) {
  const staff = await ensureStaffForUser({
    hospitalId: params.hospitalId,
    appUserId: params.actor.id,
    username: params.actor.username,
    mobile: params.actor.mobile,
    role: params.actor.role,
  });
  if (!staff) {
    return { error: "Your role cannot apply for leave.", status: 403 as const };
  }

  const clash = await overlappingLeave({
    staffId: staff.id,
    startAt: params.startAt,
    endAt: params.endAt,
    statuses: ["PENDING", "APPROVED"],
  });
  if (clash) {
    return { error: "You already have leave covering that period.", status: 409 as const };
  }

  const leave = await prisma.staffLeave.create({
    data: {
      hospitalId: params.hospitalId,
      staffId: staff.id,
      requestedByUserId: params.actor.id,
      type: params.type,
      status: "PENDING",
      startAt: params.startAt,
      endAt: params.endAt,
      reason: params.reason,
    },
    include: { staff: { include: { appUser: { select: { username: true } } } } },
  });

  await notifyHospitalRole({
    hospitalId: params.hospitalId,
    role: "SUPER_ADMIN",
    href: "/hospital/leaves",
    title: "Leave request",
    body: `${staffDisplayName(leave.staff)} requested ${params.type.toLowerCase()} leave.`,
  });

  return { leave };
}

export async function recordApprovedLeave(params: {
  hospitalId: string;
  actor: { id: string; username: string; role: AppRole };
  staffId: string;
  type: LeaveType;
  startAt: Date;
  endAt: Date;
  reason?: string | null;
}) {
  const staff = await prisma.staff.findFirst({
    where: { id: params.staffId, hospitalId: params.hospitalId },
    include: { appUser: { select: { id: true, username: true } } },
  });
  if (!staff) {
    return { error: "Staff member not found.", status: 404 as const };
  }

  const clash = await overlappingLeave({
    staffId: staff.id,
    startAt: params.startAt,
    endAt: params.endAt,
    statuses: ["APPROVED"],
  });
  if (clash) {
    return { error: "Approved leave already exists for that period.", status: 409 as const };
  }

  const leave = await prisma.staffLeave.create({
    data: {
      hospitalId: params.hospitalId,
      staffId: staff.id,
      requestedByUserId: params.actor.id,
      reviewedByUserId: params.actor.id,
      type: params.type,
      status: "APPROVED",
      startAt: params.startAt,
      endAt: params.endAt,
      reason: params.reason,
      reviewedAt: new Date(),
    },
    include: { staff: { include: { appUser: { select: { username: true } } } } },
  });

  if (staff.appUserId) {
    await notifyUser({
      hospitalId: params.hospitalId,
      userId: staff.appUserId,
      href: "/leave",
      title: "Leave recorded",
      body: `Leave was recorded for ${leave.startAt.toLocaleDateString("en-IN")} – ${leave.endAt.toLocaleDateString("en-IN")}.`,
    });
  }

  return { leave };
}

export async function reviewStaffLeave(params: {
  hospitalId: string;
  actorUserId: string;
  leaveId: string;
  action: "approve" | "reject" | "cancel";
  reviewNote?: string | null;
  actorRole: AppRole;
}) {
  const leave = await prisma.staffLeave.findFirst({
    where: { id: params.leaveId, hospitalId: params.hospitalId },
    include: { staff: { include: { appUser: { select: { id: true, username: true } } } } },
  });
  if (!leave) {
    return { error: "Leave request not found.", status: 404 as const };
  }

  if (params.action === "cancel") {
    const actorIsApplicant = leave.requestedByUserId === params.actorUserId;
    const canCancelOwn = actorIsApplicant && leave.status === "PENDING";
    const canAdminCancel = canReviewLeave(params.actorRole) && (leave.status === "PENDING" || leave.status === "APPROVED");
    if (!canCancelOwn && !canAdminCancel) {
      return { error: "This leave cannot be cancelled.", status: 403 as const };
    }
    const updated = await prisma.staffLeave.update({
      where: { id: leave.id },
      data: {
        status: "CANCELLED",
        reviewedByUserId: params.actorUserId,
        reviewNote: params.reviewNote ?? leave.reviewNote,
        reviewedAt: new Date(),
      },
    });
    return { leave: updated };
  }

  if (!canReviewLeave(params.actorRole)) {
    return { error: "Only the hospital super admin can approve or reject leave.", status: 403 as const };
  }
  if (leave.status !== "PENDING") {
    return { error: "This leave request is no longer pending.", status: 409 as const };
  }

  const status: LeaveStatus = params.action === "approve" ? "APPROVED" : "REJECTED";
  if (status === "APPROVED") {
    const clash = await overlappingLeave({
      staffId: leave.staffId,
      startAt: leave.startAt,
      endAt: leave.endAt,
      statuses: ["APPROVED"],
      excludeId: leave.id,
    });
    if (clash) {
      return { error: "Approved leave already exists for that period.", status: 409 as const };
    }
  }

  const updated = await prisma.staffLeave.update({
    where: { id: leave.id },
    data: {
      status,
      reviewedByUserId: params.actorUserId,
      reviewNote: params.reviewNote ?? null,
      reviewedAt: new Date(),
    },
  });

  if (leave.staff.appUserId) {
    await notifyUser({
      hospitalId: params.hospitalId,
      userId: leave.staff.appUserId,
      href: "/leave",
      title: status === "APPROVED" ? "Leave approved" : "Leave rejected",
      body:
        status === "APPROVED"
          ? `Your leave from ${leave.startAt.toLocaleDateString("en-IN")} was approved.`
          : `Your leave request was rejected${params.reviewNote ? `: ${params.reviewNote}` : "."}`,
    });
  }

  return { leave: updated };
}

export function staffInclude() {
  return { staff: { include: { appUser: { select: { username: true } } } } } as const;
}
