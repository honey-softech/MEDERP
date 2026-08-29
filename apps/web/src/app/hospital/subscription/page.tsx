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

export default async function HospitalSubscriptionPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN" || !user.hospitalId) {
    redirect("/login");
  }

  const [hospital, usedSeats] = await Promise.all([
    prisma.hospital.findUnique({
      where: { id: user.hospitalId },
      include: { subscription: true },
    }),
    countHospitalStaffSeats(user.hospitalId),
  ]);

  if (!hospital) {
    redirect("/login");
  }

  const seatLimit = staffSeatLimit(hospital);
  const quote = await monthlyAmountForHospital(hospital);
  const sub = hospital.subscription;
  const tier = getSubscriptionTier(hospital.subscriptionTier);

  return (
    <AppShell title="Subscription">
      <p className="mb-6 text-sm text-slate-500">
        Manage the monthly MedERP plan for {hospital.name} ({hospital.code}). Auto-debit runs every billing cycle until
        you cancel. Plan changes you schedule here apply from the next cycle.
      </p>
      {hospital.trialEndsAt && !hospitalAccessBlocked(hospital) ? (
        <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Free trial ends {hospital.trialEndsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}. Pay here to keep
          the clinic open after that date.
        </p>
      ) : null}
      {hospitalAccessBlocked(hospital) ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The free trial has ended. Start a paid subscription below to restore access for your staff.
        </p>
      ) : null}
      <HospitalSeatSubscriptionForm
        currentUsed={usedSeats}
        currentLimit={seatLimit}
        currentMonthly={quote.total}
        currentTierId={tier?.id ?? hospital.subscriptionTier}
        currentTierName={tier?.name ?? hospital.subscriptionTier}
        tiers={publicSubscriptionTiers()}
        hasSubscription={Boolean(sub && !["CANCELLED", "COMPLETED", "EXPIRED"].includes(sub.status))}
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
