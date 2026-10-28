import { AppShell } from "@/components/app-shell";
import { ReferralReviewActions } from "@/components/referral-review-actions";
import { ReferralTrackingBoard } from "@/components/referral-tracking-board";
import { prisma } from "@/lib/prisma";
import { MAX_REFERRAL_BONUS_MONTHS } from "@/lib/hospital-referrals";
import { loadLocalReferralSamples } from "@/lib/referral-tracking-samples";
import type { ReferralTrackRow } from "@/lib/referral-tracking";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

const hospitalSelect = {
  id: true,
  name: true,
  code: true,
  address: true,
  phone: true,
  trialEndsAt: true,
  createdAt: true,
  users: {
    where: { role: "SUPER_ADMIN" as const },
    select: { username: true, mobile: true },
    take: 1,
  },
};

const PAYING_SUBSCRIPTION = new Set(["ACTIVE", "AUTHENTICATED"]);

export default async function PlatformReferralsPage() {
  const [live, samples] = await Promise.all([
    prisma.hospitalReferral.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        referrerHospital: { select: hospitalSelect },
        referredHospital: {
          select: { ...hospitalSelect, subscription: { select: { status: true } } },
        },
      },
    }),
    loadLocalReferralSamples(),
  ]);

  const liveRows: ReferralTrackRow[] = live.map((row) => ({
    id: row.id,
    sample: false,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    status: row.status,
    referralCode: row.referralCode,
    rewardMonths: row.rewardMonths,
    reviewNote: row.reviewNote,
    referrerName: row.referrerHospital.name,
    referrerCode: row.referrerHospital.code,
    referredName: row.referredHospital.name,
    referredCode: row.referredHospital.code,
    paying: PAYING_SUBSCRIPTION.has(row.referredHospital.subscription?.status ?? ""),
  }));
  const tracked = [...liveRows, ...samples].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pending = live.filter((row) => row.status === "PENDING");

  const earnedByReferrer = new Map<string, number>();
  if (pending.length > 0) {
    const totals = await prisma.hospitalReferral.groupBy({
      by: ["referrerHospitalId"],
      where: {
        status: "APPROVED",
        referrerHospitalId: { in: pending.map((row) => row.referrerHospitalId) },
      },
      _sum: { rewardMonths: true },
    });
    for (const row of totals) {
      earnedByReferrer.set(row.referrerHospitalId, row._sum.rewardMonths ?? 0);
    }
  }

  return (
    <AppShell title="Referral tracking">
      <p className="mb-6 text-sm text-slate-500">
        Every clinic that signed up with another hospital&apos;s code. The board shows how many are still in review,
        how long decisions take, which referrers have used their free months, and which new clinics are paying.
        Approving a waiting referral still adds one free month, up to {MAX_REFERRAL_BONUS_MONTHS} referral months.
      </p>
      <ReferralTrackingBoard rows={tracked} includesSamples={samples.length > 0} nowIso={new Date().toISOString()} />
      <h3 className="mb-3 font-semibold">Waiting for a decision</h3>
      {pending.length === 0 ? (
        <p className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No referrals waiting for review.
        </p>
      ) : (
        <div className="mb-8 grid gap-4">
          {pending.map((item) => {
            const earned = earnedByReferrer.get(item.referrerHospitalId) ?? 0;
            const capReached = earned >= MAX_REFERRAL_BONUS_MONTHS;
            const referredAdmin = item.referredHospital.users[0];
            const referrerAdmin = item.referrerHospital.users[0];
            return (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">New clinic</p>
                    <p className="mt-1 font-semibold">
                      {item.referredHospital.name} ({item.referredHospital.code})
                    </p>
                    <p className="text-sm text-slate-500">
                      {item.referredHospital.phone || "No mobile"} · registered {formatDate(item.referredHospital.createdAt)}
                    </p>
                    <p className="text-sm text-slate-600">{item.referredHospital.address || "No address"}</p>
                    <p className="text-sm text-slate-600">
                      Super admin {referredAdmin ? `${referredAdmin.username} · ${referredAdmin.mobile}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Referring clinic</p>
                    <p className="mt-1 font-semibold">
                      {item.referrerHospital.name} ({item.referrerHospital.code})
                    </p>
                    <p className="text-sm text-slate-500">{item.referrerHospital.phone || "No mobile"}</p>
                    <p className="text-sm text-slate-600">{item.referrerHospital.address || "No address"}</p>
                    <p className="text-sm text-slate-600">
                      Super admin {referrerAdmin ? `${referrerAdmin.username} · ${referrerAdmin.mobile}` : "—"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Trial ends {formatDate(item.referrerHospital.trialEndsAt)} · referral months {earned} of{" "}
                      {MAX_REFERRAL_BONUS_MONTHS}
                    </p>
                    <p className="text-sm text-slate-500">Code used: {item.referralCode}</p>
                  </div>
                </div>
                <ReferralReviewActions referralId={item.id} capReached={capReached} />
              </article>
            );
          })}
        </div>
      )}

    </AppShell>
  );
}
