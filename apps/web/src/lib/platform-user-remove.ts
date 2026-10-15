import { invalidateUserSessions } from "@/lib/auth";
import { cancelSubscriptionForClosedHospital } from "@/lib/hospital-subscription";
import { prisma } from "@/lib/prisma";

const PROTECTED_ROLES = new Set(["SOFTWARE_ADMIN", "HELPDESK"]);

/** Soft-remove an AppUser so mobile/username can be reused. Keeps FK history intact. */
export async function removePlatformUser(params: {
  userId: string;
  actorId: string;
  /** Self-service account delete. Platform console removal still blocks removing yourself. */
  allowSelf?: boolean;
}) {
  const user = await prisma.appUser.findUnique({ where: { id: params.userId } });
  if (!user) return { ok: false as const, error: "User not found.", status: 404 };
  if (PROTECTED_ROLES.has(user.role)) {
    return { ok: false as const, error: "Platform accounts cannot be removed.", status: 403 };
  }
  if (!params.allowSelf && user.id === params.actorId) {
    return { ok: false as const, error: "You cannot remove your own account.", status: 400 };
  }
  if (user.mobile.startsWith("removed-") || user.mobile.startsWith("merged-") || user.mobile.startsWith("retired-")) {
    return { ok: false as const, error: "This account is already removed.", status: 400 };
  }

  const removedKey = `removed-${user.id}`;
  const hospitalId = user.hospitalId;
  let subscription: Awaited<ReturnType<typeof cancelSubscriptionForClosedHospital>> | null = null;

  if (user.role === "SUPER_ADMIN" && hospitalId) {
    const otherAdmins = await prisma.appUser.count({
      where: { hospitalId, role: "SUPER_ADMIN", isActive: true, id: { not: user.id } },
    });
    if (otherAdmins === 0) {
      subscription = await cancelSubscriptionForClosedHospital(hospitalId);
      if (!subscription.cancelled && subscription.reason === "failed") {
        return {
          ok: false as const,
          error: subscription.error || "Could not cancel the hospital subscription. The account was not removed.",
          status: 502,
        };
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.appSession.deleteMany({ where: { userId: user.id } });
    await tx.devicePushToken.deleteMany({ where: { userId: user.id } });

    // Drop pending join requests — user never completed hospital attachment.
    await tx.hospitalJoinRequest.deleteMany({
      where: { userId: user.id, status: "PENDING" },
    });

    const staff = await tx.staff.findUnique({ where: { appUserId: user.id } });
    if (staff) {
      await tx.staff.update({
        where: { id: staff.id },
        data: { appUserId: null, isActive: false },
      });
    }

    await tx.appUser.update({
      where: { id: user.id },
      data: {
        isActive: false,
        isVerified: false,
        hospitalId: null,
        username: removedKey.slice(0, 60),
        mobile: removedKey,
        userCode: null,
        employeeId: null,
        email: null,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
    });
  });

  await invalidateUserSessions(user.id);

  return {
    ok: true as const,
    user: {
      id: user.id,
      username: user.username,
      mobile: user.mobile,
      hospitalId,
      role: user.role,
    },
    subscription,
  };
}

export function isRemovedAccountMobile(mobile: string) {
  return (
    mobile.startsWith("removed-") || mobile.startsWith("merged-") || mobile.startsWith("retired-")
  );
}
