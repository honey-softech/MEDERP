import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HospitalSeatSubscriptionForm } from "@/components/hospital-seat-subscription-form";
import { getCurrentUser } from "@/lib/auth";
import { countHospitalStaffSeats } from "@/lib/platform-billing";
import { staffSeatLimit } from "@/lib/platform-pricing";
import { monthlyAmountForHospital } from "@/lib/hospital-subscription";
import { razorpayConfigured } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { getSubscriptionTier, publicSubscriptionTiers } from "@/lib/subscription-tiers";
import { hospitalAccessBlocked } from "@/lib/hospital-access";
import { MAX_REFERRALS_PER_HOSPITAL, MAX_TOTAL_FREE_MONTHS, referralSummary } from "@/lib/hospital-referrals";
import { ReferralCodeCopy } from "@/components/referral-code-copy";

export default async function HospitalSubscriptionPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN" || !user.hospitalId) {
    redirect("/login");
  }

  const [hospital, usedSeats, referrals] = await Promise.all([
    prisma.hospital.findUnique({
      where: { id: user.hospitalId },
      include: { subscription: true },
    }),
    countHospitalStaffSeats(user.hospitalId),
    referralSummary(user.hospitalId),
  ]);

  if (!hospital) {
    redirect("/login");
  }

  const seatLimit = staffSeatLimit(hospital);
  const quote = await monthlyAmountForHospital(hospital);
  const sub = hospital.subscription;
  const tier = getSubscriptionTier(hospital.subscriptionTier);
  const hasSubscription = Boolean(sub && !["CANCELLED", "COMPLETED", "EXPIRED"].includes(sub.status));

  return (
    <AppShell title="Subscription">
      <p className="mb-6 text-sm text-slate-500">
        Manage the monthly MedERP plan for {hospital.name} ({hospital.code}). Auto-debit runs every billing cycle until
        you cancel. Plan changes you schedule here apply from the next cycle.
      </p>
      {hospital.trialEndsAt && !hospitalAccessBlocked(hospital) && hasSubscription ? (
        <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Card linked for auto-debit. Free trial ends{" "}
          {hospital.trialEndsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
          {sub?.nextChargeAt
            ? ` · first charge ${sub.nextChargeAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`
            : ""}
          . No need to pay again until then.
        </p>
      ) : null}
      {hospital.trialEndsAt && !hospitalAccessBlocked(hospital) && !hasSubscription ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Free trial ends {hospital.trialEndsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}. Link a card below
          so auto-debit can keep the clinic open after that date.
        </p>
      ) : null}
      {hospitalAccessBlocked(hospital) ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The free trial has ended. Start a paid subscription below to restore access for your staff.
        </p>
      ) : null}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Refer a clinic</h3>
        <p className="mt-2 text-sm text-slate-600">
          Share your hospital code. When another clinic registers with it and a software admin approves the referral,
          you get 1 extra free month. You can refer up to {MAX_REFERRALS_PER_HOSPITAL} clinics. Free usage is capped at{" "}
          {MAX_TOTAL_FREE_MONTHS} months total (your first month plus up to {referrals.maxBonusMonths} referral months).
        </p>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Your referral code</p>
          <div className="mt-1">
            <ReferralCodeCopy code={hospital.code} />
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Referral months granted: {referrals.earnedMonths} of {referrals.maxBonusMonths}
          {referrals.remainingMonths === 0 ? " · free-month cap reached" : ` · ${referrals.remainingMonths} month(s) still available`}
          . Referrals recorded: {referrals.recordedReferrals} of {referrals.maxReferrals}.
        </p>
        {referrals.referrals.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No clinics have registered with your code yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {referrals.referrals.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  {row.referredName} ({row.referredCode})
                </span>
                <span className="text-slate-500">
                  {row.status === "PENDING"
                    ? "Waiting for approval"
                    : row.status === "APPROVED"
                      ? `Approved · +${row.rewardMonths} month`
                      : "Rejected"}
                  {row.reviewNote ? ` · ${row.reviewNote}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <HospitalSeatSubscriptionForm
        currentUsed={usedSeats}
        currentLimit={seatLimit}
        currentMonthly={quote.total}
        currentTierId={tier?.id ?? hospital.subscriptionTier}
        currentTierName={tier?.name ?? hospital.subscriptionTier}
        tiers={publicSubscriptionTiers()}
        hasSubscription={hasSubscription}
        pendingSubscriptionTier={sub?.pendingSubscriptionTier ?? null}
        pendingMonthlyAmount={sub?.pendingMonthlyAmount != null ? Number(sub.pendingMonthlyAmount) : null}
        nextChargeAt={sub?.nextChargeAt?.toISOString() ?? null}
        cancelAtPeriodEnd={sub?.cancelAtPeriodEnd ?? false}
        subscriptionStatus={sub?.status ?? null}
        razorpayEnabled={razorpayConfigured()}
      />
    </AppShell>
  );
}
