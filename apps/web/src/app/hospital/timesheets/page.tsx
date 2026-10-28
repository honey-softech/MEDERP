import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TimesheetAdmin } from "@/components/timesheet-admin";
import { requireHospitalPage } from "@/lib/front-desk";
import { parseMonthParam } from "@/lib/timesheet";
import { loadHospitalTimesheets } from "@/lib/timesheet-admin";

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export default async function HospitalTimesheetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireHospitalPage();
  if (user.role !== "SUPER_ADMIN") redirect("/");
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);
  const board = await loadHospitalTimesheets(user.hospitalId, year, month);

  return (
    <AppShell title="Timesheets">
      <p className="mb-4 text-sm text-slate-500">
        Set each person’s pay, mark clinic holidays, and approve the weeks they submit. Salary uses approved days only.
      </p>
      <TimesheetAdmin
        month={monthLabel(year, month)}
        prevMonth={shiftMonth(year, month, -1)}
        nextMonth={shiftMonth(year, month, 1)}
        weeklyOffDays={board.weeklyOffDays}
        holidays={board.holidays}
        pending={board.pending}
        staff={board.staff}
      />
    </AppShell>
  );
}
