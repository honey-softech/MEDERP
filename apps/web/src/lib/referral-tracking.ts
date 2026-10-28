import { MAX_REFERRAL_BONUS_MONTHS } from "@/lib/referral-limits";

export type ReferralTrackStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ReferralTrackRow = {
  id: string;
  sample: boolean;
  createdAt: string;
  reviewedAt: string | null;
  status: ReferralTrackStatus;
  referralCode: string;
  rewardMonths: number;
  reviewNote: string | null;
  referrerName: string;
  referrerCode: string;
  referredName: string;
  referredCode: string;
  paying: boolean;
};

export type ReferralSampleInput = {
  id: string;
  daysAgo: number;
  reviewedDaysAgo?: number | null;
  status: ReferralTrackStatus;
  referralCode: string;
  rewardMonths?: number;
  reviewNote?: string | null;
  referrerName: string;
  referrerCode: string;
  referredName: string;
  referredCode: string;
  paying?: boolean;
};

const DAY_MS = 86_400_000;
const STATUSES = new Set<ReferralTrackStatus>(["PENDING", "APPROVED", "REJECTED"]);

function shiftDays(now: Date, days: number) {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

export function sampleToTrackRow(input: ReferralSampleInput, now = new Date()): ReferralTrackRow | null {
  if (!input?.id || !STATUSES.has(input.status)) return null;
  if (!input.referrerName?.trim() || !input.referrerCode?.trim()) return null;
  if (!input.referredName?.trim() || !input.referredCode?.trim()) return null;
  if (!Number.isFinite(input.daysAgo) || input.daysAgo < 0) return null;

  const pending = input.status === "PENDING";
  const reviewedDaysAgo = pending ? null : (input.reviewedDaysAgo ?? input.daysAgo);
  return {
    id: input.id,
    sample: true,
    createdAt: shiftDays(now, input.daysAgo),
    reviewedAt: reviewedDaysAgo == null ? null : shiftDays(now, reviewedDaysAgo),
    status: input.status,
    referralCode: input.referralCode.trim(),
    rewardMonths: input.status === "APPROVED" ? Math.max(0, input.rewardMonths ?? 0) : 0,
    reviewNote: input.reviewNote?.trim() || null,
    referrerName: input.referrerName.trim(),
    referrerCode: input.referrerCode.trim(),
    referredName: input.referredName.trim(),
    referredCode: input.referredCode.trim(),
    paying: input.status === "APPROVED" && Boolean(input.paying),
  };
}

export function parseReferralSamples(raw: string, now = new Date()) {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    const row = sampleToTrackRow(item as ReferralSampleInput, now);
    return row ? [row] : [];
  });
}

export function daysBetween(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round(ms / DAY_MS));
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function referralTrackingStats(rows: ReferralTrackRow[], now = new Date()) {
  const pending = rows.filter((row) => row.status === "PENDING");
  const approved = rows.filter((row) => row.status === "APPROVED");
  const rejected = rows.filter((row) => row.status === "REJECTED");
  const decided = approved.length + rejected.length;
  const paying = approved.filter((row) => row.paying);
  const reviewDays = [...approved, ...rejected]
    .filter((row) => row.reviewedAt)
    .map((row) => daysBetween(row.createdAt, row.reviewedAt!));
  const openDays = pending.map((row) => daysBetween(row.createdAt, now.toISOString()));

  return {
    total: rows.length,
    pending: pending.length,
    approved: approved.length,
    rejected: rejected.length,
    paying: paying.length,
    monthsGranted: approved.reduce((sum, row) => sum + row.rewardMonths, 0),
    approvalRate: decided === 0 ? null : approved.length / decided,
    paidRate: approved.length === 0 ? null : paying.length / approved.length,
    medianReviewDays: median(reviewDays),
    oldestPendingDays: openDays.length === 0 ? null : Math.max(...openDays),
  };
}

export type ReferrerScore = {
  code: string;
  name: string;
  sent: number;
  pending: number;
  approved: number;
  rejected: number;
  paying: number;
  monthsGranted: number;
  monthsLeft: number;
};

export type ReferralChain = {
  code: string;
  name: string;
  links: ReferralTrackRow[];
};

/** One referring clinic and the clinics that signed up with its code, newest first. */
export function referralChains(rows: ReferralTrackRow[]): ReferralChain[] {
  const byCode = new Map<string, ReferralChain>();
  for (const row of rows) {
    const current = byCode.get(row.referrerCode) ?? {
      code: row.referrerCode,
      name: row.referrerName,
      links: [],
    };
    current.links.push(row);
    byCode.set(row.referrerCode, current);
  }
  for (const chain of byCode.values()) {
    chain.links.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return [...byCode.values()].sort(
    (a, b) => b.links.length - a.links.length || a.name.localeCompare(b.name),
  );
}

export function referrerScores(rows: ReferralTrackRow[]): ReferrerScore[] {
  const byCode = new Map<string, ReferrerScore>();
  for (const row of rows) {
    const current = byCode.get(row.referrerCode) ?? {
      code: row.referrerCode,
      name: row.referrerName,
      sent: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      paying: 0,
      monthsGranted: 0,
      monthsLeft: MAX_REFERRAL_BONUS_MONTHS,
    };
    current.sent += 1;
    if (row.status === "PENDING") current.pending += 1;
    if (row.status === "APPROVED") current.approved += 1;
    if (row.status === "REJECTED") current.rejected += 1;
    if (row.paying) current.paying += 1;
    current.monthsGranted += row.rewardMonths;
    current.monthsLeft = Math.max(0, MAX_REFERRAL_BONUS_MONTHS - current.monthsGranted);
    byCode.set(row.referrerCode, current);
  }
  return [...byCode.values()].sort(
    (a, b) => b.approved - a.approved || b.paying - a.paying || b.sent - a.sent || a.name.localeCompare(b.name),
  );
}

export type ReferralMonth = {
  key: string;
  label: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
};

export function monthlyReferralActivity(rows: ReferralTrackRow[], now = new Date(), months = 6): ReferralMonth[] {
  const buckets: ReferralMonth[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: cursor.toLocaleDateString("en-IN", { month: "short" }),
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    });
  }
  const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const row of rows) {
    const created = new Date(row.createdAt);
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const bucket = index.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (row.status === "APPROVED") bucket.approved += 1;
    if (row.status === "PENDING") bucket.pending += 1;
    if (row.status === "REJECTED") bucket.rejected += 1;
  }
  return buckets;
}
