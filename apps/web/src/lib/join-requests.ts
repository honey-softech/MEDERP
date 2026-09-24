import type { AppRole, AppUser } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/auth";
import { notifyUser } from "@/lib/notifications";
import { ensureDoctorStaff } from "@/lib/front-desk";
import { nextEmployeeId, nextUserCode } from "@/lib/employee";
import { assertStaffSeatAvailable } from "@/lib/platform-billing";
import { moduleErrorForRole } from "@/lib/platform-pricing";

/** Hospital join requests belong to that hospital's SUPER_ADMIN — not the platform software admin. */
export function canReviewJoinRequests(user: Pick<AppUser, "id" | "role" | "hospitalId">, hospitalId: string) {
  return user.role === "SUPER_ADMIN" && user.hospitalId === hospitalId;
}

export async function notifyJoinRequested(params: {
  hospitalId: string;
  requesterName: string;
  role: AppRole;
}) {
  // Prefer any active hospital SUPER_ADMIN (verified or not) so requests reach the hospital,
  // not the platform inbox.
  let hospitalAdmins = await prisma.appUser.findMany({
    where: { hospitalId: params.hospitalId, role: "SUPER_ADMIN", isActive: true },
    select: { id: true },
  });
  if (hospitalAdmins.length === 0) {
    hospitalAdmins = await prisma.appUser.findMany({
      where: { hospitalId: params.hospitalId, role: "SUPER_ADMIN" },
      select: { id: true },
    });
  }

  const roleLabel = params.role.replace(/_/g, " ").toLowerCase();
  const body = `${params.requesterName} requested to join as ${roleLabel}. Open Join requests to approve or decline.`;

  if (hospitalAdmins.length === 0) {
    console.warn(
      `Join request for hospital ${params.hospitalId}: no SUPER_ADMIN to notify. Platform will not auto-approve.`,
    );
    return;
  }

  for (const admin of hospitalAdmins) {
    await notifyUser({
      hospitalId: params.hospitalId,
      userId: admin.id,
      href: "/hospital/join-requests",
      title: "Staff wants to join",
      body,
    });
  }
}

export async function approveJoinRequest(params: {
  requestId: string;
  actor: Pick<AppUser, "id" | "username" | "role" | "hospitalId">;
  role?: AppRole;
  reviewNote?: string;
}) {
  const request = await prisma.hospitalJoinRequest.findUnique({
    where: { id: params.requestId },
    include: { user: true, hospital: true },
  });
  if (!request || request.status !== "PENDING") {
    return { error: "This join request is no longer pending.", status: 404 as const };
  }
  if (!canReviewJoinRequests(params.actor, request.hospitalId)) {
    return { error: "You cannot approve join requests for this hospital.", status: 403 as const };
  }
  if (request.user.hospitalId && request.user.hospitalId !== request.hospitalId) {
    return { error: "This user already belongs to another hospital.", status: 409 as const };
  }

  const role = params.role && STAFF_ROLES.includes(params.role) ? params.role : request.requestedRole;
  if (!STAFF_ROLES.includes(role)) {
    return { error: "Select a valid hospital staff role.", status: 400 as const };
  }

  const moduleError = moduleErrorForRole(role, request.hospital);
  if (moduleError) {
    return { error: moduleError, status: 403 as const };
  }

  try {
    await assertStaffSeatAvailable(request.hospitalId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Staff limit reached.",
      status: 403 as const,
    };
  }

  const userCode = request.user.userCode ?? (await nextUserCode(request.hospitalId, role));
  const employeeId = request.user.employeeId ?? (await nextEmployeeId(request.hospitalId, request.hospital.code));

  await prisma.$transaction([
    prisma.appUser.update({
      where: { id: request.userId },
      data: {
        hospitalId: request.hospitalId,
        role,
        userCode,
        employeeId,
        isActive: true,
      },
    }),
    prisma.hospitalJoinRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        requestedRole: role,
        reviewedById: params.actor.id,
        reviewNote: params.reviewNote || null,
        reviewedAt: new Date(),
      },
    }),
    prisma.hospitalJoinRequest.updateMany({
      where: { userId: request.userId, status: "PENDING", id: { not: request.id } },
      data: {
        status: "REJECTED",
        reviewNote: `Joined ${request.hospital.name} instead.`,
        reviewedById: params.actor.id,
        reviewedAt: new Date(),
      },
    }),
  ]);

  if (role === "DOCTOR") {
    await ensureDoctorStaff({
      hospitalId: request.hospitalId,
      appUserId: request.userId,
      username: request.user.username,
      mobile: request.user.mobile,
    });
  }

  await notifyUser({
    hospitalId: request.hospitalId,
    userId: request.userId,
    href: "/",
    title: "Hospital join approved",
    body: `${params.actor.username} added you to ${request.hospital.name} as ${role.replace(/_/g, " ").toLowerCase()}.`,
  });

  return { request, role };
}

export async function rejectJoinRequest(params: {
  requestId: string;
  actor: Pick<AppUser, "id" | "username" | "role" | "hospitalId">;
  reviewNote?: string;
}) {
  const request = await prisma.hospitalJoinRequest.findUnique({
    where: { id: params.requestId },
    include: { user: true, hospital: true },
  });
  if (!request || request.status !== "PENDING") {
    return { error: "This join request is no longer pending.", status: 404 as const };
  }
  if (!canReviewJoinRequests(params.actor, request.hospitalId)) {
    return { error: "You cannot reject join requests for this hospital.", status: 403 as const };
  }

  await prisma.hospitalJoinRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      reviewedById: params.actor.id,
      reviewNote: params.reviewNote || null,
      reviewedAt: new Date(),
    },
  });

  await notifyUser({
    hospitalId: request.hospitalId,
    userId: request.userId,
    href: "/join",
    title: "Hospital join declined",
    body: `${request.hospital.name} declined your join request.${params.reviewNote ? ` ${params.reviewNote}` : ""}`,
  });

  return { request };
}
