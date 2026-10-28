import { staffDisplayName } from "@/lib/staff-leave";
import { loadStaffTimesheet, dateKeyToUtc, dateKeyFromDb } from "@/lib/timesheet";
import { prisma } from "@/lib/prisma";

export async function loadHospitalTimesheets(hospitalId: string, year: number, month: number) {
  const [staff, settings, holidays, pending] = await Promise.all([
    prisma.staff.findMany({
      where: { hospitalId, isActive: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        payProfile: true,
        appUser: { select: { username: true, role: true } },
      },
    }),
    prisma.hospitalPayrollSettings.findUnique({ where: { hospitalId } }),
    prisma.hospitalHoliday.findMany({ where: { hospitalId }, orderBy: { date: "asc" } }),
    prisma.timesheetWeek.findMany({
      where: { hospitalId, status: "SUBMITTED" },
      orderBy: [{ weekStart: "asc" }],
      include: { staff: true },
    }),
  ]);

  const rows = [];
  for (const person of staff) {
    if (person.appUser?.role === "SUPER_ADMIN") continue;
    const monthView = await loadStaffTimesheet(hospitalId, person.id, year, month);
    rows.push({
      id: person.id,
      name: staffDisplayName(person),
      role: person.role,
      payBasis: person.payProfile?.payBasis ?? "MONTHLY",
      monthlyAmount: person.payProfile?.monthlyAmount == null ? "" : String(person.payProfile.monthlyAmount),
      dailyRate: person.payProfile?.dailyRate == null ? "" : String(person.payProfile.dailyRate),
      monthDivisor: person.payProfile?.monthDivisor ?? "FIXED_30",
      casualLeaveDays: person.payProfile?.casualLeaveDays ?? 0,
      sickLeaveDays: person.payProfile?.sickLeaveDays ?? 0,
      salary: monthView.salary,
    });
  }

  return {
    weeklyOffDays: (settings?.weeklyOffDays ?? "0").split(",").filter(Boolean),
    holidays: holidays.map((row) => ({ id: row.id, date: dateKeyFromDb(row.date), name: row.name })),
    pending: pending.map((row) => ({
        staffId: row.staffId,
        name: staffDisplayName(row.staff),
        weekStart: dateKeyFromDb(row.weekStart),
      })),
    staff: rows,
  };
}

export async function saveStaffPay(params: {
  hospitalId: string;
  staffId: string;
  payBasis: "MONTHLY" | "DAILY";
  monthlyAmount: number | null;
  dailyRate: number | null;
  monthDivisor: "FIXED_30" | "CALENDAR_DAYS";
  casualLeaveDays: number;
  sickLeaveDays: number;
}) {
  const staff = await prisma.staff.findFirst({ where: { id: params.staffId, hospitalId: params.hospitalId } });
  if (!staff) throw new Error("Staff member was not found.");
  if (params.payBasis === "MONTHLY" && !(params.monthlyAmount && params.monthlyAmount > 0)) {
    throw new Error("Enter the monthly salary.");
  }
  if (params.payBasis === "DAILY" && !(params.dailyRate && params.dailyRate > 0)) {
    throw new Error("Enter the daily rate.");
  }
  if (params.casualLeaveDays < 0 || params.sickLeaveDays < 0) throw new Error("Leave days cannot be negative.");
  await prisma.staffPayProfile.upsert({
    where: { staffId: staff.id },
    create: {
      hospitalId: params.hospitalId,
      staffId: staff.id,
      payBasis: params.payBasis,
      monthlyAmount: params.payBasis === "MONTHLY" ? params.monthlyAmount : null,
      dailyRate: params.payBasis === "DAILY" ? params.dailyRate : null,
      monthDivisor: params.monthDivisor,
      casualLeaveDays: params.casualLeaveDays,
      sickLeaveDays: params.sickLeaveDays,
    },
    update: {
      payBasis: params.payBasis,
      monthlyAmount: params.payBasis === "MONTHLY" ? params.monthlyAmount : null,
      dailyRate: params.payBasis === "DAILY" ? params.dailyRate : null,
      monthDivisor: params.monthDivisor,
      casualLeaveDays: params.casualLeaveDays,
      sickLeaveDays: params.sickLeaveDays,
    },
  });
}

export async function saveWeeklyOff(hospitalId: string, days: number[]) {
  const unique = [...new Set(days.filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b);
  await prisma.hospitalPayrollSettings.upsert({
    where: { hospitalId },
    create: { hospitalId, weeklyOffDays: unique.join(",") },
    update: { weeklyOffDays: unique.join(",") },
  });
}

export async function addHoliday(hospitalId: string, date: string, name: string) {
  const label = name.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label) throw new Error("Enter a date and a name.");
  await prisma.hospitalHoliday.upsert({
    where: { hospitalId_date: { hospitalId, date: dateKeyToUtc(date) } },
    create: { hospitalId, date: dateKeyToUtc(date), name: label },
    update: { name: label },
  });
}

export async function removeHoliday(hospitalId: string, id: string) {
  await prisma.hospitalHoliday.deleteMany({ where: { id, hospitalId } });
}
