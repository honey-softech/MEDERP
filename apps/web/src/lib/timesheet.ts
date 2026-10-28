import type { AppRole, LeaveType, TimesheetDayKind, TimesheetWeekStatus } from "@prisma/client";
import { STAFF_ROLES } from "@/lib/auth";
import { CLINIC_TIME_ZONE } from "@/lib/clinic-time";
import {
  addDaysKey,
  monthDateKeys,
  salaryForMonth,
  weekDateKeys,
  weekStartKey,
  weekdayOfKey,
  type PayProfileInput,
  type SalaryDayInput,
} from "@/lib/payroll";
import { prisma } from "@/lib/prisma";

export function canFillTimesheet(role: AppRole) {
  return STAFF_ROLES.includes(role);
}

export function clinicTodayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dateKeyToUtc(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateKeyFromDb(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function parseMonthParam(value?: string | null, now = new Date()) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year: Number(match[1]), month };
  }
  const today = clinicTodayKey(now);
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

export function weekEditable(status: TimesheetWeekStatus | null) {
  return status == null || status === "DRAFT" || status === "RETURNED";
}

function weeklyOffSet(raw?: string | null) {
  if (raw == null) return new Set([0]);
  return new Set(
    raw
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  );
}

function leaveKind(type: LeaveType): TimesheetDayKind {
  if (type === "CASUAL") return "CASUAL_LEAVE";
  if (type === "SICK") return "SICK_LEAVE";
  return "ABSENT";
}

function clockOk(value: string | null | undefined) {
  if (!value) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
}

export type TimesheetDayView = {
  date: string;
  weekday: number;
  weeklyOff: boolean;
  holidayName: string | null;
  kind: TimesheetDayKind | null;
  clockIn: string | null;
  clockOut: string | null;
  note: string | null;
  weekStart: string;
  weekStatus: TimesheetWeekStatus | null;
  reviewNote: string | null;
  locked: boolean;
  fromLeave: boolean;
};

async function payrollContext(hospitalId: string) {
  const [settings, holidays] = await Promise.all([
    prisma.hospitalPayrollSettings.findUnique({ where: { hospitalId } }),
    prisma.hospitalHoliday.findMany({ where: { hospitalId }, orderBy: { date: "asc" } }),
  ]);
  return {
    weeklyOff: weeklyOffSet(settings?.weeklyOffDays),
    holidays: new Map(holidays.map((row) => [dateKeyFromDb(row.date), row.name])),
  };
}

function toProfile(row: {
  payBasis: "MONTHLY" | "DAILY";
  monthlyAmount: { toString(): string } | null;
  dailyRate: { toString(): string } | null;
  monthDivisor: "FIXED_30" | "CALENDAR_DAYS";
  casualLeaveDays: number;
  sickLeaveDays: number;
}): PayProfileInput {
  return {
    payBasis: row.payBasis,
    monthlyAmount: row.monthlyAmount == null ? null : Number(row.monthlyAmount),
    dailyRate: row.dailyRate == null ? null : Number(row.dailyRate),
    monthDivisor: row.monthDivisor,
    casualLeaveDays: row.casualLeaveDays,
    sickLeaveDays: row.sickLeaveDays,
  };
}

export async function loadStaffTimesheet(hospitalId: string, staffId: string, year: number, month: number) {
  const keys = monthDateKeys(year, month);
  const rangeStart = dateKeyToUtc(keys[0]);
  const rangeEnd = dateKeyToUtc(addDaysKey(keys[keys.length - 1], 1));
  const yearStart = dateKeyToUtc(`${year}-01-01`);
  const weekStarts = [...new Set(keys.map(weekStartKey))].map(dateKeyToUtc);
  const { weeklyOff, holidays } = await payrollContext(hospitalId);

  const [profile, days, weeks, leaves, priorDays, priorWeeks] = await Promise.all([
    prisma.staffPayProfile.findUnique({ where: { staffId } }),
    prisma.timesheetDay.findMany({ where: { staffId, date: { gte: rangeStart, lt: rangeEnd } } }),
    prisma.timesheetWeek.findMany({ where: { staffId, weekStart: { in: weekStarts } } }),
    prisma.staffLeave.findMany({
      where: {
        hospitalId,
        staffId,
        status: "APPROVED",
        startAt: { lt: rangeEnd },
        endAt: { gte: rangeStart },
      },
    }),
    prisma.timesheetDay.findMany({
      where: {
        staffId,
        date: { gte: yearStart, lt: rangeStart },
        kind: { in: ["CASUAL_LEAVE", "SICK_LEAVE"] },
      },
    }),
    prisma.timesheetWeek.findMany({
      where: { staffId, status: "APPROVED", weekStart: { gte: dateKeyToUtc(weekStartKey(`${year}-01-01`)), lt: rangeStart } },
      select: { weekStart: true },
    }),
  ]);

  const dayByKey = new Map(days.map((row) => [dateKeyFromDb(row.date), row]));
  const weekByKey = new Map(weeks.map((row) => [dateKeyFromDb(row.weekStart), row]));
  const approvedPrior = new Set(priorWeeks.map((row) => dateKeyFromDb(row.weekStart)));
  let casualUsedBefore = 0;
  let sickUsedBefore = 0;
  for (const row of priorDays) {
    const key = dateKeyFromDb(row.date);
    if (!approvedPrior.has(weekStartKey(key))) continue;
    if (row.kind === "CASUAL_LEAVE") casualUsedBefore += 1;
    if (row.kind === "SICK_LEAVE") sickUsedBefore += 1;
  }

  const views: TimesheetDayView[] = keys.map((date) => {
    const stored = dayByKey.get(date);
    const weekKey = weekStartKey(date);
    const week = weekByKey.get(weekKey);
    const holidayName = holidays.get(date) ?? null;
    const weeklyOffDay = weeklyOff.has(weekdayOfKey(date));
    const leave = leaves.find((row) => {
      const start = dateKeyFromDb(row.startAt);
      const end = dateKeyFromDb(row.endAt);
      return date >= start && date <= end;
    });
    const fromLeave = !stored && Boolean(leave) && !weeklyOffDay && !holidayName;
    return {
      date,
      weekday: weekdayOfKey(date),
      weeklyOff: weeklyOffDay,
      holidayName,
      kind: stored?.kind ?? (fromLeave && leave ? leaveKind(leave.type) : null),
      clockIn: stored?.clockIn ?? null,
      clockOut: stored?.clockOut ?? null,
      note: stored?.note ?? (fromLeave ? leave?.reason ?? null : null),
      weekStart: weekKey,
      weekStatus: week?.status ?? null,
      reviewNote: week?.reviewNote ?? null,
      locked: weeklyOffDay || Boolean(holidayName) || !weekEditable(week?.status ?? null),
      fromLeave,
    };
  });

  const salaryDays: SalaryDayInput[] = views.map((day) => ({
    date: day.date,
    weekStatus: day.weekStatus ?? "DRAFT",
    kind: day.kind,
    clockIn: day.clockIn,
    clockOut: day.clockOut,
    weeklyOff: day.weeklyOff,
    holiday: Boolean(day.holidayName),
  }));

  const salary = profile
    ? salaryForMonth({
        profile: toProfile(profile),
        year,
        month,
        days: salaryDays,
        casualUsedBefore,
        sickUsedBefore,
      })
    : null;

  const weekGroups = [...new Set(views.map((day) => day.weekStart))].map((start) => {
    const sample = views.find((day) => day.weekStart === start);
    return {
      weekStart: start,
      weekEnd: addDaysKey(start, 6),
      status: sample?.weekStatus ?? null,
      reviewNote: sample?.reviewNote ?? null,
      canSubmit: views.some((day) => day.weekStart === start && !day.weeklyOff && !day.holidayName) && weekEditable(sample?.weekStatus ?? null),
    };
  });

  return { days: views, weeks: weekGroups, salary, hasPay: Boolean(profile), casualLeaveDays: profile?.casualLeaveDays ?? 0, sickLeaveDays: profile?.sickLeaveDays ?? 0 };
}

export async function saveTimesheetDay(params: {
  hospitalId: string;
  staffId: string;
  date: string;
  kind: TimesheetDayKind;
  clockIn?: string | null;
  clockOut?: string | null;
  note?: string | null;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) throw new Error("Choose a valid day.");
  const clockIn = clockOk(params.clockIn);
  const clockOut = clockOk(params.clockOut);
  if (clockIn === undefined || clockOut === undefined) throw new Error("Enter times as HH:MM.");
  if (params.kind === "WORKED" && (!clockIn || !clockOut)) throw new Error("Enter both clock in and clock out.");
  if (clockIn && clockOut && clockOut <= clockIn) throw new Error("Clock out must be after clock in.");

  const { weeklyOff, holidays } = await payrollContext(params.hospitalId);
  if (weeklyOff.has(weekdayOfKey(params.date)) || holidays.has(params.date)) {
    throw new Error("Weekly off and clinic holidays are set by the hospital.");
  }
  const start = dateKeyToUtc(weekStartKey(params.date));
  const week = await prisma.timesheetWeek.findUnique({
    where: { staffId_weekStart: { staffId: params.staffId, weekStart: start } },
  });
  if (!weekEditable(week?.status ?? null)) throw new Error("This week is locked until the admin sends it back.");

  await prisma.timesheetDay.upsert({
    where: { staffId_date: { staffId: params.staffId, date: dateKeyToUtc(params.date) } },
    create: {
      hospitalId: params.hospitalId,
      staffId: params.staffId,
      date: dateKeyToUtc(params.date),
      kind: params.kind,
      clockIn: params.kind === "WORKED" || params.kind === "HALF_DAY" ? clockIn : null,
      clockOut: params.kind === "WORKED" || params.kind === "HALF_DAY" ? clockOut : null,
      note: params.note?.trim() || null,
    },
    update: {
      kind: params.kind,
      clockIn: params.kind === "WORKED" || params.kind === "HALF_DAY" ? clockIn : null,
      clockOut: params.kind === "WORKED" || params.kind === "HALF_DAY" ? clockOut : null,
      note: params.note?.trim() || null,
    },
  });
}

export async function submitTimesheetWeek(hospitalId: string, staffId: string, weekStart: string) {
  const startKey = weekStartKey(weekStart);
  const start = dateKeyToUtc(startKey);
  const existing = await prisma.timesheetWeek.findUnique({
    where: { staffId_weekStart: { staffId, weekStart: start } },
  });
  if (!weekEditable(existing?.status ?? null)) throw new Error("This week is already submitted.");
  const weekEnd = addDaysKey(startKey, 6);
  if (clinicTodayKey() < weekEnd) throw new Error("Submit this week on Sunday, after the days are filled in.");
  const dates = weekDateKeys(startKey);
  const { weeklyOff, holidays } = await payrollContext(hospitalId);
  const leaves = await prisma.staffLeave.findMany({
    where: {
      hospitalId,
      staffId,
      status: "APPROVED",
      startAt: { lt: dateKeyToUtc(addDaysKey(dates[6], 1)) },
      endAt: { gte: start },
    },
  });
  for (const date of dates) {
    if (weeklyOff.has(weekdayOfKey(date)) || holidays.has(date)) continue;
    const stored = await prisma.timesheetDay.findUnique({
      where: { staffId_date: { staffId, date: dateKeyToUtc(date) } },
    });
    if (stored) continue;
    const leave = leaves.find((row) => date >= dateKeyFromDb(row.startAt) && date <= dateKeyFromDb(row.endAt));
    if (!leave) continue;
    await prisma.timesheetDay.create({
      data: {
        hospitalId,
        staffId,
        date: dateKeyToUtc(date),
        kind: leaveKind(leave.type),
        note: leave.reason,
      },
    });
  }
  await prisma.timesheetWeek.upsert({
    where: { staffId_weekStart: { staffId, weekStart: start } },
    create: { hospitalId, staffId, weekStart: start, status: "SUBMITTED", submittedAt: new Date() },
    update: { status: "SUBMITTED", submittedAt: new Date(), reviewNote: null, reviewedAt: null, reviewedByUserId: null },
  });
  return startKey;
}

export async function reviewTimesheetWeek(params: {
  hospitalId: string;
  staffId: string;
  weekStart: string;
  action: "approve" | "return";
  reviewNote?: string | null;
  reviewerUserId: string;
}) {
  const start = dateKeyToUtc(weekStartKey(params.weekStart));
  const week = await prisma.timesheetWeek.findFirst({
    where: { hospitalId: params.hospitalId, staffId: params.staffId, weekStart: start },
  });
  if (!week || week.status !== "SUBMITTED") throw new Error("Only a submitted week can be reviewed.");
  await prisma.timesheetWeek.update({
    where: { id: week.id },
    data: {
      status: params.action === "approve" ? "APPROVED" : "RETURNED",
      reviewNote: params.reviewNote?.trim() || null,
      reviewedAt: new Date(),
      reviewedByUserId: params.reviewerUserId,
    },
  });
}

export { weekDateKeys };
