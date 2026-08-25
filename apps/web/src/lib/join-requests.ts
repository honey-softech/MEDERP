import type { AppRole, AppUser } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/auth";
import { notifyUser } from "@/lib/notifications";
import { ensureDoctorStaff } from "@/lib/front-desk";
import { nextUserCode } from "@/lib/employee";
import { assertStaffSeatAvailable } from "@/lib/platform-billing";
import { moduleErrorForRole } from "@/lib/platform-pricing";

export function canReviewJoinRequests(user: Pick<AppUser, "id" | "role" | "hospitalId">, hospitalId: string) {
  if (user.role === "SOFTWARE_ADMIN") return true;
  return user.role === "SUPER_ADMIN" && user.hospitalId === hospitalId;
}

export async function notifyJoinRequested(params: {
  hospitalId: string;
  requesterName: string;
  role: AppRole;
}) {
  const [hospitalAdmins, platformAdmins] = await Promise.all([
    prisma.appUser.findMany({
      where: { hospitalId: params.hospitalId, role: "SUPER_ADMIN", isVerified: true, isActive: true },
      select: { id: true, hospitalId: true },
    }),
    prisma.appUser.findMany({
      where: { role: "SOFTWARE_ADMIN", isVerified: true, isActive: true },
      select: { id: true, hospitalId: true },
    }),
  ]);
  const roleLabel = params.role.replace(/_/g, " ").toLowerCase();
  const body = `${params.requesterName} requested to join as ${roleLabel}. Review the request to add them.`;
  for (const admin of hospitalAdmins) {
    await notifyUser({
      hospitalId: params.hospitalId,
      userId: admin.id,
      href: "/hospital/join-requests",
      title: "Staff wants to join",
      body,
    });
  }
  for (const admin of platformAdmins) {
    await notifyUser({
      hospitalId: params.hospitalId,
      userId: admin.id,
      href: "/platform/join-requests",
      title: "Hospital join request",
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

  await prisma.$transaction([
    prisma.appUser.update({
      where: { id: request.userId },
      data: {
        hospitalId: request.hospitalId,
        role,
        userCode,
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
