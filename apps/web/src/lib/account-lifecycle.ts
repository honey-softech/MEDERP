import type { AppRole, Prisma } from "@prisma/client";
import { PLATFORM_ROLES, isPlatformRole } from "@/lib/auth";
import { LAST_SUPER_ADMIN_MESSAGE, lastSuperAdminBlocksSelfService } from "@/lib/account-guards";
import { isRemovedAccountMobile, removePlatformUser } from "@/lib/platform-user-remove";
import { cancelSubscriptionForClosedHospital } from "@/lib/hospital-subscription";
import { prisma } from "@/lib/prisma";

export { LAST_SUPER_ADMIN_MESSAGE, lastSuperAdminBlocksSelfService };

type Actor = {
  id: string;
  role: AppRole | string;
  hospitalId: string | null;
  username?: string;
  mobile?: string;
};

async function otherActiveSuperAdmins(hospitalId: string, userId: string) {
  return prisma.appUser.count({
    where: {
      hospitalId,
      role: "SUPER_ADMIN",
      isActive: true,
      id: { not: userId },
    },
  });
}

export async function selfServiceBlockReason(user: Actor) {
  if (!user.hospitalId || user.role !== "SUPER_ADMIN") return null;
  const hospital = await prisma.hospital.findUnique({
    where: { id: user.hospitalId },
    select: { isActive: true },
  });
  const others = hospital?.isActive ? await otherActiveSuperAdmins(user.hospitalId, user.id) : 0;
  if (
    lastSuperAdminBlocksSelfService({
      role: user.role,
      hospitalIsActive: Boolean(hospital?.isActive),
      otherActiveSuperAdmins: others,
    })
  ) {
    return LAST_SUPER_ADMIN_MESSAGE;
  }
  return null;
}

async function detachHospitalUser(tx: Prisma.TransactionClient, userId: string, reviewNote: string) {
  await tx.appSession.deleteMany({ where: { userId } });
  const staff = await tx.staff.findUnique({ where: { appUserId: userId } });
  if (staff) {
    await tx.staff.update({
      where: { id: staff.id },
      data: { appUserId: null, isActive: false },
    });
  }
  await tx.hospitalJoinRequest.updateMany({
    where: { userId, status: "PENDING" },
    data: { status: "REJECTED", reviewNote, reviewedAt: new Date() },
  });
  await tx.appUser.update({
    where: { id: userId },
    data: { hospitalId: null, userCode: null, employeeId: null },
  });
}

export async function assertCanCloseHospital(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN" || !actor.hospitalId) {
    return { ok: false as const, error: "Hospital admin access required.", status: 403 };
  }
  const hospital = await prisma.hospital.findUnique({
    where: { id: actor.hospitalId },
    select: { id: true, name: true, code: true, isActive: true },
  });
  if (!hospital) return { ok: false as const, error: "Hospital not found.", status: 404 };
  if (!hospital.isActive) return { ok: false as const, error: "This hospital is already closed.", status: 400 };
  return { ok: true as const, hospital };
}

export async function closeHospitalRecord(
  hospital: { id: string; name: string; code: string },
  options?: { allowInactive?: boolean },
) {
  const hospitalId = hospital.id;
  const subscription = await cancelSubscriptionForClosedHospital(hospitalId);
  if (!subscription.cancelled && subscription.reason === "failed") {
    return {
      ok: false as const,
      error: subscription.error || "Could not cancel the hospital subscription. The hospital was not removed.",
      status: 502,
    };
  }

  const detachedUsers = await prisma.$transaction(async (tx) => {
    const current = await tx.hospital.findUnique({
      where: { id: hospitalId },
      select: { isActive: true, removedAt: true },
    });
    if (!current || current.removedAt) return null;
    if (!current.isActive && !options?.allowInactive) return null;

    const users = await tx.appUser.findMany({
      where: { hospitalId, role: { notIn: [...PLATFORM_ROLES] } },
      select: { id: true, mobile: true },
    });

    await tx.staff.updateMany({
      where: { hospitalId },
      data: { appUserId: null, isActive: false, phone: null },
    });

    for (const user of users) {
      await tx.appSession.deleteMany({ where: { userId: user.id } });
      await tx.devicePushToken.deleteMany({ where: { userId: user.id } });
      const released = isRemovedAccountMobile(user.mobile);
      const retiredKey = `removed-${user.id}`.slice(0, 60);
      await tx.appUser.update({
        where: { id: user.id },
        data: {
          isActive: false,
          isVerified: false,
          hospitalId: null,
          userCode: null,
          employeeId: null,
          email: null,
          otpCode: null,
          otpExpiresAt: null,
          otpAttempts: 0,
          ...(released ? {} : { mobile: retiredKey, username: retiredKey }),
        },
      });
    }

    await tx.hospitalJoinRequest.updateMany({
      where: { hospitalId, status: "PENDING" },
      data: { status: "REJECTED", reviewNote: "Hospital closed.", reviewedAt: new Date() },
    });

    await tx.hospital.update({
      where: { id: hospitalId },
      data: { isActive: false, removedAt: new Date(), phone: null, altPhones: null },
    });
    return users.length;
  });

  if (detachedUsers == null) {
    return { ok: false as const, error: "This hospital is already closed.", status: 400 };
  }

  return { ok: true as const, hospital, detachedUsers, subscription };
}

export async function closeHospital(actor: Actor) {
  const allowed = await assertCanCloseHospital(actor);
  if (!allowed.ok) return allowed;
  return closeHospitalRecord(allowed.hospital);
}

export async function assertCanLeaveHospital(actor: Actor) {
  if (isPlatformRole(actor.role as AppRole)) {
    return { ok: false as const, error: "Platform accounts stay on the software console.", status: 403 };
  }
  if (!actor.hospitalId) {
    return { ok: false as const, error: "You are not linked to a hospital.", status: 400 };
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: actor.hospitalId },
    select: { id: true, name: true, code: true, isActive: true },
  });
  if (!hospital || !hospital.isActive) {
    return { ok: false as const, error: "This hospital is already closed.", status: 400 };
  }

  const blocked = await selfServiceBlockReason(actor);
  if (blocked) return { ok: false as const, error: blocked, status: 400 };
  return { ok: true as const, hospital };
}

export async function leaveHospital(actor: Actor) {
  const allowed = await assertCanLeaveHospital(actor);
  if (!allowed.ok) return allowed;
  await prisma.$transaction((tx) => detachHospitalUser(tx, actor.id, "Left the hospital."));
  return { ok: true as const, hospital: allowed.hospital };
}

export async function assertCanDeleteAccount(actor: Actor & { mobile: string }) {
  if (isPlatformRole(actor.role as AppRole)) {
    return { ok: false as const, error: "Platform accounts cannot be removed.", status: 403 };
  }
  if (isRemovedAccountMobile(actor.mobile)) {
    return { ok: false as const, error: "This account is already removed.", status: 400 };
  }
  if (actor.hospitalId) {
    const blocked = await selfServiceBlockReason(actor);
    if (blocked) return { ok: false as const, error: blocked, status: 400 };
  }
  return { ok: true as const };
}

export async function deleteOwnAccount(actor: Actor & { mobile: string }) {
  const allowed = await assertCanDeleteAccount(actor);
  if (!allowed.ok) return allowed;
  return removePlatformUser({ userId: actor.id, actorId: actor.id, allowSelf: true });
}
