import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { ReferralReviewActions } from "@/components/referral-review-actions";
import { prisma } from "@/lib/prisma";
import { MAX_REFERRAL_BONUS_MONTHS } from "@/lib/hospital-referrals";

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

export default async function PlatformReferralsPage() {
  const [pending, decided] = await Promise.all([
    prisma.hospitalReferral.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        referrerHospital: { select: hospitalSelect },
        referredHospital: { select: hospitalSelect },
      },
    }),
    prisma.hospitalReferral.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 100,
      include: {
        referrerHospital: { select: { name: true, code: true } },
        referredHospital: { select: { name: true, code: true } },
      },
    }),
  ]);

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
    <AppShell title="Referrals">
      <p className="mb-6 text-sm text-slate-500">
        A new clinic that enters another hospital&apos;s code at signup appears here. Check both hospitals, then
        approve to add one free month for the referrer. Free usage is capped at 3 months total (the first month plus
        up to {MAX_REFERRAL_BONUS_MONTHS} referral months).
      </p>
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

      <h3 className="mb-3 font-semibold">Past decisions</h3>
      <FilterableTable
        minWidthClass="min-w-[52rem]"
        empty="No reviewed referrals yet."
        rows={decided.map((row) => ({
          id: row.id,
          when: formatDate(row.reviewedAt ?? row.createdAt),
          referrer: `${row.referrerHospital.name} (${row.referrerHospital.code})`,
          referred: `${row.referredHospital.name} (${row.referredHospital.code})`,
          status: row.status === "APPROVED" ? "Approved" : "Rejected",
          months: row.status === "APPROVED" ? String(row.rewardMonths) : "0",
          note: row.reviewNote || "—",
        }))}
        columns={[
          { key: "when", header: "Reviewed" },
          { key: "referrer", header: "Referrer" },
          { key: "referred", header: "New clinic" },
          { key: "status", header: "Decision" },
          { key: "months", header: "Months added" },
          { key: "note", header: "Note" },
        ]}
      />
    </AppShell>
  );
}
