import { describe, expect, it } from "vitest";
import {
  monthlyReferralActivity,
  parseReferralSamples,
  referralChains,
  referralTrackingStats,
  referrerScores,
  sampleToTrackRow,
} from "@/lib/referral-tracking";

const now = new Date(2026, 9, 28);

describe("referral tracking samples", () => {
  it("turns day offsets into a read-only tracking row", () => {
    const row = sampleToTrackRow(
      {
        id: "sample-1",
        daysAgo: 10,
        reviewedDaysAgo: 3,
        status: "APPROVED",
        referralCode: "GFCLIN",
        rewardMonths: 1,
        referrerName: "Greenfield Clinic",
        referrerCode: "GFCLIN",
        referredName: "Lakeview Clinic",
        referredCode: "LAKE",
        paying: true,
      },
      now,
    );
    expect(row?.sample).toBe(true);
    expect(row?.paying).toBe(true);
    expect(row?.rewardMonths).toBe(1);
    expect(row?.createdAt).toBe(new Date(2026, 9, 18).toISOString());
    expect(row?.reviewedAt).toBe(new Date(2026, 9, 25).toISOString());
  });

  it("drops a pending review date and ignores broken rows", () => {
    const rows = parseReferralSamples(
      JSON.stringify([
        {
          id: "sample-2",
          daysAgo: 1,
          reviewedDaysAgo: 0,
          status: "PENDING",
          referralCode: "GFCLIN",
          rewardMonths: 1,
          referrerName: "Greenfield Clinic",
          referrerCode: "GFCLIN",
          referredName: "North Ward Clinic",
          referredCode: "NORTH",
        },
        { id: "", status: "APPROVED" },
      ]),
      now,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reviewedAt).toBeNull();
    expect(rows[0]?.rewardMonths).toBe(0);
    expect(rows[0]?.paying).toBe(false);
  });
});

describe("referral tracking stats", () => {
  const rows = parseReferralSamples(
    JSON.stringify([
      {
        id: "a",
        daysAgo: 20,
        reviewedDaysAgo: 12,
        status: "APPROVED",
        referralCode: "GFCLIN",
        rewardMonths: 1,
        referrerName: "Greenfield Clinic",
        referrerCode: "GFCLIN",
        referredName: "Lakeview Clinic",
        referredCode: "LAKE",
        paying: true,
      },
      {
        id: "b",
        daysAgo: 8,
        reviewedDaysAgo: 2,
        status: "REJECTED",
        referralCode: "GFCLIN",
        referrerName: "Greenfield Clinic",
        referrerCode: "GFCLIN",
        referredName: "Closed Clinic",
        referredCode: "CLOSED",
      },
      {
        id: "c",
        daysAgo: 3,
        status: "PENDING",
        referralCode: "HILL",
        referrerName: "Hilltop Polyclinic",
        referrerCode: "HILL",
        referredName: "New Clinic",
        referredCode: "NEWC",
      },
    ]),
    now,
  );

  it("summarises decisions, payment, and review time", () => {
    const stats = referralTrackingStats(rows, now);
    expect(stats).toMatchObject({
      total: 3,
      pending: 1,
      approved: 1,
      rejected: 1,
      paying: 1,
      monthsGranted: 1,
      approvalRate: 0.5,
      paidRate: 1,
      medianReviewDays: 7,
      oldestPendingDays: 3,
    });
  });

  it("groups each referrer with the clinics they brought in", () => {
    const chains = referralChains(rows);
    expect(chains.map((chain) => chain.code)).toEqual(["GFCLIN", "HILL"]);
    expect(chains[0]?.links.map((link) => link.referredCode)).toEqual(["CLOSED", "LAKE"]);
  });

  it("ranks referrers and counts remaining free months", () => {
    const scores = referrerScores(rows);
    expect(scores.map((row) => row.code)).toEqual(["GFCLIN", "HILL"]);
    expect(scores[0]).toMatchObject({ sent: 2, approved: 1, rejected: 1, paying: 1, monthsGranted: 1, monthsLeft: 1 });
  });

  it("buckets signups into the recent months", () => {
    const months = monthlyReferralActivity(rows, now);
    const october = months.find((month) => month.key === "2026-10");
    expect(months).toHaveLength(6);
    expect(october).toMatchObject({ total: 3, approved: 1, pending: 1, rejected: 1 });
  });
});
