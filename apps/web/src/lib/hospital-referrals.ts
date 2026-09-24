import { prisma } from "@/lib/prisma";
import { normalizeHospitalCode } from "@/lib/auth";
import { TRIAL_MONTHS } from "@/lib/hospital-access";
import { notifyUser } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit";

/** Extra free months granted to the referrer for one approved referral. */
export const REFERRAL_REWARD_MONTHS = 1;
/** How many clinics one hospital may refer (pending + approved). */
export const MAX_REFERRALS_PER_HOSPITAL = 3;
/** Base trial plus referral bonus. Referral rewards stop once this total is reached. */
export const MAX_TOTAL_FREE_MONTHS = 3;
export const MAX_REFERRAL_BONUS_MONTHS = MAX_TOTAL_FREE_MONTHS - TRIAL_MONTHS;

export class ReferralReviewError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function extendTrialEnd(current: Date | null | undefined, months: number, now = new Date()) {
  const base = current && current.getTime() > now.getTime() ? current : now;
  const next = new Date(base.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatTrialDate(value: Date | null | undefined) {
  if (!value) return "not set";
  return value.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

/** Active hospital that owns this code, or null when the code is unknown or inactive. */
export async function findReferrerByCode(code: string) {
  const normalized = normalizeHospitalCode(code);
  if (!normalized) return null;
  return prisma.hospital.findFirst({
    where: { code: normalized, isActive: true },
    select: { id: true, name: true, code: true },
  });
}

/** Pending and approved referrals count toward the per-hospital limit. Rejected ones do not. */
export async function openReferralCount(hospitalId: string) {
  return prisma.hospitalReferral.count({
    where: { referrerHospitalId: hospitalId, status: { in: ["PENDING", "APPROVED"] } },
  });
}

export async function earnedBonusMonths(hospitalId: string) {
  const agg = await prisma.hospitalReferral.aggregate({
    where: { referrerHospitalId: hospitalId, status: "APPROVED" },
    _sum: { rewardMonths: true },
  });
  return agg._sum.rewardMonths ?? 0;
}

export async function referralSummary(hospitalId: string) {
  const [earnedMonths, referrals] = await Promise.all([
    earnedBonusMonths(hospitalId),
    prisma.hospitalReferral.findMany({
      where: { referrerHospitalId: hospitalId },
      orderBy: { createdAt: "desc" },
      include: { referredHospital: { select: { name: true, code: true } } },
    }),
  ]);

  const pending = referrals.filter((row) => row.status === "PENDING").length;
  const approved = referrals.filter((row) => row.status === "APPROVED").length;
  const rejected = referrals.filter((row) => row.status === "REJECTED").length;

  return {
    earnedMonths,
    maxBonusMonths: MAX_REFERRAL_BONUS_MONTHS,
    remainingMonths: Math.max(0, MAX_REFERRAL_BONUS_MONTHS - earnedMonths),
    maxReferrals: MAX_REFERRALS_PER_HOSPITAL,
    recordedReferrals: pending + approved,
    counts: { pending, approved, rejected },
    referrals: referrals.map((row) => ({
      id: row.id,
      status: row.status,
      rewardMonths: row.rewardMonths,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      reviewNote: row.reviewNote,
      referredName: row.referredHospital.name,
      referredCode: row.referredHospital.code,
    })),
  };
}

export async function notifyReferralSubmitted(params: {
  referredHospitalId: string;
  referredHospitalName: string;
  referrerHospitalName: string;
  referralCode: string;
}) {
  const admins = await prisma.appUser.findMany({
    where: { role: "SOFTWARE_ADMIN", isVerified: true, isActive: true },
    select: { id: true },
  });
  const body = `${params.referredHospitalName} registered with referral code ${params.referralCode} (${params.referrerHospitalName}). Review both hospitals and approve or reject the free month.`;
  for (const admin of admins) {
    await notifyUser({
      hospitalId: params.referredHospitalId,
      userId: admin.id,
      href: "/platform/referrals",
      title: "Clinic referral to review",
      body,
    });
  }
}

export async function createReferralFromCode(params: {
  referrerHospitalId: string;
  referredHospitalId: string;
  referralCode: string;
  referredHospitalName: string;
  referrerHospitalName: string;
  request?: Request;
  actor?: { userId?: string | null; username: string; role?: string | null };
}) {
  if (params.referrerHospitalId === params.referredHospitalId) {
    throw new Error("A hospital cannot refer itself.");
  }

  const row = await prisma.hospitalReferral.create({
    data: {
      referrerHospitalId: params.referrerHospitalId,
      referredHospitalId: params.referredHospitalId,
      referralCode: params.referralCode,
      status: "PENDING",
      rewardMonths: 0,
    },
  });

  await writeAuditLog({
    request: params.request,
    hospitalId: params.referredHospitalId,
    actorUserId: params.actor?.userId,
    actorUsername: params.actor?.username ?? "registration",
    actorRole: params.actor?.role,
    action: "REFERRAL_SUBMITTED",
    entity: "HospitalReferral",
    entityId: row.id,
    summary: `${params.referredHospitalName} registered with referral code ${params.referralCode} (${params.referrerHospitalName}). Waiting for software admin approval.`,
    metadata: {
      referrerHospitalId: params.referrerHospitalId,
      referralCode: params.referralCode,
    },
  });

  try {
    await notifyReferralSubmitted({
      referredHospitalId: params.referredHospitalId,
      referredHospitalName: params.referredHospitalName,
      referrerHospitalName: params.referrerHospitalName,
      referralCode: params.referralCode,
    });
  } catch (error) {
    console.error("Failed to notify software admins of referral", error);
  }

  return row;
}

async function notifyReferrerAdmins(params: {
  hospitalId: string;
  title: string;
  body: string;
}) {
  const admins = await prisma.appUser.findMany({
    where: { hospitalId: params.hospitalId, role: "SUPER_ADMIN", isVerified: true, isActive: true },
    select: { id: true },
  });
  for (const admin of admins) {
    await notifyUser({
      hospitalId: params.hospitalId,
      userId: admin.id,
      href: "/hospital/subscription",
      title: params.title,
      body: params.body,
    });
  }
}

export async function approveReferral(params: {
  referralId: string;
  actor: { id: string; username: string; role: string };
  note?: string | null;
  request?: Request;
}) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const referral = await tx.hospitalReferral.findUnique({
      where: { id: params.referralId },
      include: {
        referrerHospital: { select: { id: true, name: true, code: true, trialEndsAt: true } },
        referredHospital: { select: { id: true, name: true, code: true } },
      },
    });
    if (!referral || referral.status !== "PENDING") {
      throw new ReferralReviewError("This referral is no longer pending.", 404);
    }

    await tx.$queryRaw`SELECT "id" FROM "Hospital" WHERE "id" = ${referral.referrerHospitalId} FOR UPDATE`;

    const fresh = await tx.hospitalReferral.findUnique({
      where: { id: referral.id },
      select: { status: true },
    });
    if (!fresh || fresh.status !== "PENDING") {
      throw new ReferralReviewError("This referral is no longer pending.", 404);
    }

    const earnedAgg = await tx.hospitalReferral.aggregate({
      where: { referrerHospitalId: referral.referrerHospitalId, status: "APPROVED" },
      _sum: { rewardMonths: true },
    });
    const earned = earnedAgg._sum.rewardMonths ?? 0;
    const rewardMonths = Math.max(0, Math.min(REFERRAL_REWARD_MONTHS, MAX_REFERRAL_BONUS_MONTHS - earned));

    let trialEndsAt = referral.referrerHospital.trialEndsAt;
    if (rewardMonths > 0) {
      trialEndsAt = extendTrialEnd(trialEndsAt, rewardMonths, now);
      await tx.hospital.update({
        where: { id: referral.referrerHospitalId },
        data: { trialEndsAt },
      });
    }

    const updated = await tx.hospitalReferral.updateMany({
      where: { id: referral.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        rewardMonths,
        reviewedById: params.actor.id,
        reviewedAt: now,
        reviewNote: params.note?.trim() || null,
      },
    });
    if (updated.count !== 1) {
      throw new ReferralReviewError("This referral is no longer pending.", 404);
    }

    return { referral, rewardMonths, trialEndsAt };
  });

  const { referral, rewardMonths, trialEndsAt } = result;
  const referredLabel = `${referral.referredHospital.name} (${referral.referredHospital.code})`;
  const body =
    rewardMonths > 0
      ? `${referredLabel} was approved as your referral. ${rewardMonths} free month was added. Trial now ends ${formatTrialDate(trialEndsAt)}.`
      : `${referredLabel} was approved, but this clinic has already reached the ${MAX_TOTAL_FREE_MONTHS}-month free limit, so no extra month was added.`;

  try {
    await notifyReferrerAdmins({
      hospitalId: referral.referrerHospitalId,
      title: rewardMonths > 0 ? "Referral approved — free month added" : "Referral approved",
      body,
    });
  } catch (error) {
    console.error("Failed to notify referrer of approval", error);
  }

  await writeAuditLog({
    request: params.request,
    hospitalId: referral.referrerHospitalId,
    actorUserId: params.actor.id,
    actorUsername: params.actor.username,
    actorRole: params.actor.role,
    action: "REFERRAL_APPROVED",
    entity: "HospitalReferral",
    entityId: referral.id,
    summary: `${params.actor.username} approved the referral of ${referredLabel} by ${referral.referrerHospital.code}; +${rewardMonths} month.`,
    metadata: {
      referredHospitalId: referral.referredHospitalId,
      rewardMonths,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      reviewNote: params.note?.trim() || null,
    },
  });

  return { rewardMonths, trialEndsAt };
}

export async function rejectReferral(params: {
  referralId: string;
  actor: { id: string; username: string; role: string };
  note?: string | null;
  request?: Request;
}) {
  const now = new Date();
  const referral = await prisma.$transaction(async (tx) => {
    const existing = await tx.hospitalReferral.findUnique({
      where: { id: params.referralId },
      include: {
        referrerHospital: { select: { id: true, name: true, code: true } },
        referredHospital: { select: { id: true, name: true, code: true } },
      },
    });
    if (!existing || existing.status !== "PENDING") {
      throw new ReferralReviewError("This referral is no longer pending.", 404);
    }
    const updated = await tx.hospitalReferral.updateMany({
      where: { id: existing.id, status: "PENDING" },
      data: {
        status: "REJECTED",
        rewardMonths: 0,
        reviewedById: params.actor.id,
        reviewedAt: now,
        reviewNote: params.note?.trim() || null,
      },
    });
    if (updated.count !== 1) {
      throw new ReferralReviewError("This referral is no longer pending.", 404);
    }
    return existing;
  });

  const referredLabel = `${referral.referredHospital.name} (${referral.referredHospital.code})`;
  const note = params.note?.trim();
  try {
    await notifyReferrerAdmins({
      hospitalId: referral.referrerHospitalId,
      title: "Referral declined",
      body: note
        ? `The referral of ${referredLabel} was declined. ${note}`
        : `The referral of ${referredLabel} was declined. No free month was added.`,
    });
  } catch (error) {
    console.error("Failed to notify referrer of rejection", error);
  }

  await writeAuditLog({
    request: params.request,
    hospitalId: referral.referrerHospitalId,
    actorUserId: params.actor.id,
    actorUsername: params.actor.username,
    actorRole: params.actor.role,
    action: "REFERRAL_REJECTED",
    entity: "HospitalReferral",
    entityId: referral.id,
    summary: `${params.actor.username} rejected the referral of ${referredLabel} by ${referral.referrerHospital.code}.`,
    metadata: {
      referredHospitalId: referral.referredHospitalId,
      reviewNote: note || null,
    },
  });

  return { ok: true as const };
}
