export type PayBasis = "MONTHLY" | "DAILY";
export type MonthDivisor = "FIXED_30" | "CALENDAR_DAYS";
export type TimesheetDayKind = "WORKED" | "HALF_DAY" | "CASUAL_LEAVE" | "SICK_LEAVE" | "ABSENT";
export type TimesheetWeekStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";

export type PayProfileInput = {
  payBasis: PayBasis;
  monthlyAmount: number | null;
  dailyRate: number | null;
  monthDivisor: MonthDivisor;
  casualLeaveDays: number;
  sickLeaveDays: number;
};

export type SalaryDayInput = {
  date: string;
  weekStatus: TimesheetWeekStatus | "OPEN";
  kind: TimesheetDayKind | null;
  clockIn: string | null;
  clockOut: string | null;
  weeklyOff: boolean;
  holiday: boolean;
};

export type SalaryBreakdown = {
  dailyRate: number;
  expectedDays: number;
  paidDays: number;
  unpaidDays: number;
  pendingDays: number;
  casualUsed: number;
  sickUsed: number;
  casualUsedYear: number;
  sickUsedYear: number;
  amount: number;
};

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthDateKeys(year: number, month: number) {
  const count = daysInMonth(year, month);
  const keys: string[] = [];
  for (let day = 1; day <= count; day += 1) {
    keys.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return keys;
}

export function weekdayOfKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDaysKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday of the week that ends on this Sunday, or null on other days. */
export function sundayApprovalWeek(todayKey: string) {
  if (weekdayOfKey(todayKey) !== 0) return null;
  return addDaysKey(todayKey, -6);
}

/** Monday that starts the clinic week containing this date. */
export function weekStartKey(dateKey: string) {
  const weekday = weekdayOfKey(dateKey);
  const delta = weekday === 0 ? 6 : weekday - 1;
  return addDaysKey(dateKey, -delta);
}

export function weekDateKeys(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysKey(weekStart, index));
}

export function dailyRateFor(profile: PayProfileInput, year: number, month: number) {
  if (profile.payBasis === "DAILY") return roundMoney(profile.dailyRate ?? 0);
  const monthly = profile.monthlyAmount ?? 0;
  const divisor = profile.monthDivisor === "FIXED_30" ? 30 : daysInMonth(year, month);
  if (divisor <= 0) return 0;
  return roundMoney(monthly / divisor);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function worked(day: SalaryDayInput) {
  return Boolean(day.clockIn?.trim() && day.clockOut?.trim());
}

/**
 * Monthly pay is the month's base minus unpaid approved days.
 * Days in a week that is not approved are withheld until approval.
 * Daily pay is only the approved days that earn a unit.
 */
export function salaryForMonth(params: {
  profile: PayProfileInput;
  year: number;
  month: number;
  days: SalaryDayInput[];
  casualUsedBefore: number;
  sickUsedBefore: number;
}): SalaryBreakdown {
  const expectedDays =
    params.profile.payBasis === "DAILY"
      ? 0
      : params.profile.monthDivisor === "FIXED_30"
        ? 30
        : daysInMonth(params.year, params.month);
  const rate = dailyRateFor(params.profile, params.year, params.month);
  const ordered = [...params.days].sort((a, b) => a.date.localeCompare(b.date));
  let casualLeft = Math.max(0, params.profile.casualLeaveDays - params.casualUsedBefore);
  let sickLeft = Math.max(0, params.profile.sickLeaveDays - params.sickUsedBefore);
  let casualUsed = 0;
  let sickUsed = 0;
  let unpaid = 0;
  let pending = 0;
  let earned = 0;

  for (const day of ordered) {
    if (day.weekStatus !== "APPROVED") {
      pending += 1;
      continue;
    }
    if (day.weeklyOff || day.holiday) {
      earned += 1;
      continue;
    }
    if (day.kind === "HALF_DAY") {
      earned += 0.5;
      unpaid += 0.5;
      continue;
    }
    if (day.kind === "CASUAL_LEAVE") {
      casualUsed += 1;
      if (casualLeft > 0) {
        casualLeft -= 1;
        earned += 1;
      } else {
        unpaid += 1;
      }
      continue;
    }
    if (day.kind === "SICK_LEAVE") {
      sickUsed += 1;
      if (sickLeft > 0) {
        sickLeft -= 1;
        earned += 1;
      } else {
        unpaid += 1;
      }
      continue;
    }
    if (day.kind === "ABSENT" || !worked(day)) {
      unpaid += 1;
      continue;
    }
    earned += 1;
  }

  const paidDays =
    params.profile.payBasis === "DAILY" ? earned : Math.max(0, expectedDays - unpaid - pending);
  return {
    dailyRate: rate,
    expectedDays,
    paidDays: roundMoney(paidDays),
    unpaidDays: roundMoney(unpaid),
    pendingDays: pending,
    casualUsed,
    sickUsed,
    casualUsedYear: params.casualUsedBefore + casualUsed,
    sickUsedYear: params.sickUsedBefore + sickUsed,
    amount: roundMoney(rate * paidDays),
  };
}
