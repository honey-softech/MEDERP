import { describe, expect, it } from "vitest";
import { monthDateKeys, salaryForMonth, sundayApprovalWeek, weekStartKey, type SalaryDayInput } from "@/lib/payroll";

function month(overrides: Partial<SalaryDayInput> = {}) {
  return monthDateKeys(2026, 10).map((date) => ({
    date,
    weekStatus: "APPROVED" as const,
    kind: "WORKED" as const,
    clockIn: "09:00",
    clockOut: "17:00",
    weeklyOff: false,
    holiday: false,
    ...overrides,
  }));
}

describe("sundayApprovalWeek", () => {
  it("points at the Monday of the week that ends that Sunday", () => {
    expect(sundayApprovalWeek("2026-10-25")).toBe("2026-10-19");
    expect(sundayApprovalWeek("2026-10-26")).toBeNull();
  });
});

describe("salaryForMonth", () => {
  it("pays a 20,000 monthly salary on a 30-day basis minus two absences", () => {
    const days = month();
    days[0] = { ...days[0], kind: "ABSENT", clockIn: null, clockOut: null };
    days[1] = { ...days[1], kind: "ABSENT", clockIn: null, clockOut: null };
    const result = salaryForMonth({
      profile: {
        payBasis: "MONTHLY",
        monthlyAmount: 20000,
        dailyRate: null,
        monthDivisor: "FIXED_30",
        casualLeaveDays: 0,
        sickLeaveDays: 0,
      },
      year: 2026,
      month: 10,
      days,
      casualUsedBefore: 0,
      sickUsedBefore: 0,
    });
    expect(result.dailyRate).toBe(666.67);
    expect(result.unpaidDays).toBe(2);
    expect(result.paidDays).toBe(28);
    expect(result.amount).toBe(18666.76);
  });

  it("keeps weekly off and holidays paid and does not spend leave allowance", () => {
    const days = month();
    days[3] = { ...days[3], weeklyOff: true, kind: null, clockIn: null, clockOut: null };
    days[4] = { ...days[4], holiday: true, kind: null, clockIn: null, clockOut: null };
    const result = salaryForMonth({
      profile: {
        payBasis: "MONTHLY",
        monthlyAmount: 30000,
        dailyRate: null,
        monthDivisor: "FIXED_30",
        casualLeaveDays: 1,
        sickLeaveDays: 0,
      },
      year: 2026,
      month: 10,
      days,
      casualUsedBefore: 0,
      sickUsedBefore: 0,
    });
    expect(result.unpaidDays).toBe(0);
    expect(result.casualUsed).toBe(0);
    expect(result.amount).toBe(30000);
  });

  it("pays casual leave only up to that person's allowance", () => {
    const days = month();
    days[2] = { ...days[2], kind: "CASUAL_LEAVE", clockIn: null, clockOut: null };
    days[5] = { ...days[5], kind: "CASUAL_LEAVE", clockIn: null, clockOut: null };
    const result = salaryForMonth({
      profile: {
        payBasis: "DAILY",
        monthlyAmount: null,
        dailyRate: 1000,
        monthDivisor: "FIXED_30",
        casualLeaveDays: 1,
        sickLeaveDays: 0,
      },
      year: 2026,
      month: 10,
      days,
      casualUsedBefore: 0,
      sickUsedBefore: 0,
    });
    expect(result.casualUsed).toBe(2);
    expect(result.unpaidDays).toBe(1);
    expect(result.paidDays).toBe(30);
    expect(result.amount).toBe(30000);
  });

  it("withholds days until the week is approved", () => {
    const days = month().map((day) =>
      weekStartKey(day.date) === "2026-10-05" ? { ...day, weekStatus: "SUBMITTED" as const } : day,
    );
    const result = salaryForMonth({
      profile: {
        payBasis: "MONTHLY",
        monthlyAmount: 30000,
        dailyRate: null,
        monthDivisor: "FIXED_30",
        casualLeaveDays: 0,
        sickLeaveDays: 0,
      },
      year: 2026,
      month: 10,
      days,
      casualUsedBefore: 0,
      sickUsedBefore: 0,
    });
    expect(result.pendingDays).toBe(7);
    expect(result.paidDays).toBe(23);
  });

  it("counts a half day as half pay", () => {
    const days = month();
    days[6] = { ...days[6], kind: "HALF_DAY", clockIn: "09:00", clockOut: "13:00" };
    const result = salaryForMonth({
      profile: {
        payBasis: "MONTHLY",
        monthlyAmount: 30000,
        dailyRate: null,
        monthDivisor: "FIXED_30",
        casualLeaveDays: 0,
        sickLeaveDays: 0,
      },
      year: 2026,
      month: 10,
      days,
      casualUsedBefore: 0,
      sickUsedBefore: 0,
    });
    expect(result.unpaidDays).toBe(0.5);
    expect(result.paidDays).toBe(29.5);
  });
});
