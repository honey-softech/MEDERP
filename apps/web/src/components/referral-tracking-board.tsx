"use client";

import { useState } from "react";
import { ExpandToggle } from "@/components/expand-toggle";
import { FilterableTable } from "@/components/filterable-table";
import { MAX_REFERRAL_BONUS_MONTHS } from "@/lib/referral-limits";
import {
  daysBetween,
  monthlyReferralActivity,
  referralChains,
  referralTrackingStats,
  referrerScores,
  type ReferralTrackRow,
} from "@/lib/referral-tracking";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function percent(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function linkTone(row: ReferralTrackRow) {
  if (row.status === "REJECTED") {
    return {
      label: "Declined",
      card: "border-slate-200 bg-slate-50 text-slate-500",
      dot: "bg-slate-400",
    };
  }
  if (row.status === "PENDING") {
    return {
      label: "Waiting",
      card: "border-amber-200 bg-amber-50 text-slate-800",
      dot: "bg-amber-500",
    };
  }
  if (row.paying) {
    return {
      label: "Paying",
      card: "border-teal-200 bg-teal-50 text-slate-900",
      dot: "bg-teal-700",
    };
  }
  return {
    label: "Approved",
    card: "border-teal-200 bg-white text-slate-900",
    dot: "border border-teal-700 bg-white",
  };
}

function ReferralMap({ rows }: { rows: ReferralTrackRow[] }) {
  const chains = referralChains(rows);
  const [open, setOpen] = useState(true);
  if (chains.length === 0) return null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Who referred whom</h3>
          <p className="mt-1 text-sm text-slate-500">Each clinic on the left, and the clinics that signed up with its code.</p>
        </div>
        <ExpandToggle open={open} onToggle={() => setOpen((current) => !current)} />
      </div>
      {open ? (
        <>
          <ul className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
            <li className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-700" />
              Paying
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-teal-700 bg-white" />
              Approved
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Waiting
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Declined
            </li>
          </ul>
          <ul className="mt-5 space-y-3">
            {chains.map((chain) => (
              <li
                key={chain.code}
                className="grid items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-[minmax(11rem,15rem)_2rem_minmax(0,1fr)] md:gap-3"
              >
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Referrer</p>
                  <p className="mt-1 font-semibold text-slate-900">{chain.name}</p>
                  <p className="text-xs text-slate-500">{chain.code}</p>
                </div>
                <div className="flex items-center justify-center text-slate-400 md:flex-col" aria-hidden>
                  <span className="hidden h-px w-full bg-slate-300 md:block" />
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 rotate-90 md:rotate-0" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {chain.links.map((link) => {
                    const tone = linkTone(link);
                    return (
                      <li key={link.id} className={`rounded-xl border px-3 py-2.5 ${tone.card}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium ${link.status === "REJECTED" ? "line-through decoration-slate-300" : ""}`}>
                            {link.referredName}
                          </p>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium">
                            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                            {tone.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs opacity-70">
                          {link.referredCode}
                          {link.sample ? " · Sample" : ""}
                          {link.rewardMonths > 0 ? ` · ${link.rewardMonths} month` : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </article>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function ReferralTrackingBoard({
  rows,
  includesSamples,
  nowIso,
}: {
  rows: ReferralTrackRow[];
  includesSamples: boolean;
  nowIso: string;
}) {
  const now = new Date(nowIso);
  const stats = referralTrackingStats(rows, now);
  const referrers = referrerScores(rows);
  const months = monthlyReferralActivity(rows, now);
  const peak = Math.max(1, ...months.map((month) => month.total));

  return (
    <section className="mb-10 space-y-6">
      {includesSamples ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Sample clinics are mixed in so this board is visible on this machine. They are not saved, cannot be
          approved, and are left out of production.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Recorded" value={String(stats.total)} hint="Signups that used a clinic code" />
        <Stat
          label="Awaiting review"
          value={String(stats.pending)}
          hint={stats.oldestPendingDays == null ? "Nothing waiting" : `Oldest open ${stats.oldestPendingDays} day(s)`}
        />
        <Stat
          label="Approved"
          value={String(stats.approved)}
          hint={`${percent(stats.approvalRate)} of decided referrals`}
        />
        <Stat
          label="Now paying"
          value={String(stats.paying)}
          hint={`${percent(stats.paidRate)} of approved clinics linked a plan`}
        />
        <Stat label="Rejected" value={String(stats.rejected)} hint="Declined, no free month" />
        <Stat
          label="Months granted"
          value={String(stats.monthsGranted)}
          hint={`Each clinic can earn ${MAX_REFERRAL_BONUS_MONTHS}`}
        />
        <Stat
          label="Median review"
          value={stats.medianReviewDays == null ? "—" : `${stats.medianReviewDays}d`}
          hint="Signup to approve or reject"
        />
        <Stat
          label="Referring clinics"
          value={String(referrers.length)}
          hint={`${referrers.filter((row) => row.monthsLeft === 0).length} already at the free-month cap`}
        />
      </div>

      <ReferralMap rows={rows} />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Last 6 months</h3>
          <p className="mt-1 text-sm text-slate-500">New referral signups, by the month they registered.</p>
          <ul className="mt-4 space-y-3">
            {months.map((month) => (
              <li key={month.key} className="grid grid-cols-[3rem_1fr] items-center gap-3">
                <span className="text-xs font-medium text-slate-500">{month.label}</span>
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-700"
                      style={{ width: `${Math.round((month.total / peak) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {month.total === 0
                      ? "None"
                      : `${month.total} · ${month.approved} approved · ${month.pending} waiting · ${month.rejected} rejected`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Funnel</h3>
          <p className="mt-1 text-sm text-slate-500">From a code used at signup through to a paid plan.</p>
          <ol className="mt-4 space-y-3">
            {[
              { label: "Used a referral code", value: stats.total },
              { label: "Still in review", value: stats.pending },
              { label: "Approved", value: stats.approved },
              { label: "Paying", value: stats.paying },
            ].map((step) => (
              <li key={step.label}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span>{step.label}</span>
                  <span className="font-semibold">{step.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-700"
                    style={{ width: stats.total === 0 ? "0%" : `${Math.round((step.value / stats.total) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>

      <div>
        <h3 className="mb-3 font-semibold">Referring clinics</h3>
        <FilterableTable
          minWidthClass="min-w-[52rem]"
          searchPlaceholder="Search a referring clinic"
          empty="No referring clinics yet."
          rows={referrers.map((row) => ({
            id: row.code,
            clinic: `${row.name} (${row.code})`,
            sent: String(row.sent),
            pending: String(row.pending),
            approved: String(row.approved),
            rejected: String(row.rejected),
            paying: String(row.paying),
            months: `${row.monthsGranted} of ${MAX_REFERRAL_BONUS_MONTHS}`,
            left: row.monthsLeft === 0 ? "Cap reached" : `${row.monthsLeft} left`,
          }))}
          columns={[
            { key: "clinic", header: "Clinic" },
            { key: "sent", header: "Sent" },
            { key: "pending", header: "Waiting" },
            { key: "approved", header: "Approved" },
            { key: "rejected", header: "Rejected" },
            { key: "paying", header: "Paying" },
            { key: "months", header: "Months earned" },
            { key: "left", header: "Cap" },
          ]}
        />
      </div>

      <div>
        <h3 className="mb-3 font-semibold">Every referral</h3>
        <FilterableTable
          minWidthClass="min-w-[64rem]"
          searchPlaceholder="Search clinic, code, or status"
          empty="No referrals recorded yet."
          rows={rows.map((row) => ({
            id: row.id,
            when: formatDate(row.createdAt),
            referrer: `${row.referrerName} (${row.referrerCode})`,
            referred: `${row.referredName} (${row.referredCode})`,
            code: row.referralCode,
            status: row.status === "PENDING" ? "Pending" : row.status === "APPROVED" ? "Approved" : "Rejected",
            months: String(row.rewardMonths),
            days:
              row.reviewedAt != null
                ? `${daysBetween(row.createdAt, row.reviewedAt)}d to decision`
                : `Open ${daysBetween(row.createdAt, nowIso)}d`,
            paying: row.paying ? "Paying" : row.status === "APPROVED" ? "Not linked" : "—",
            note: row.reviewNote || "—",
            source: row.sample ? "Sample" : "Live",
          }))}
          columns={[
            { key: "when", header: "Signed up" },
            { key: "referrer", header: "Referrer" },
            { key: "referred", header: "New clinic" },
            { key: "code", header: "Code" },
            { key: "status", header: "Status" },
            { key: "months", header: "Months" },
            { key: "days", header: "Timing" },
            { key: "paying", header: "Plan" },
            { key: "note", header: "Note" },
            { key: "source", header: "Source" },
          ]}
        />
      </div>
    </section>
  );
}
