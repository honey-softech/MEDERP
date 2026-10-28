import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TimesheetBoard } from "@/components/timesheet-board";
import { requireHospitalPage } from "@/lib/front-desk";
import { canFillTimesheet, loadStaffTimesheet, parseMonthParam } from "@/lib/timesheet";

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export default async function TimesheetPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireHospitalPage();
  if (!canFillTimesheet(user.role)) redirect("/");
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);
  const sheet = user.staffProfile?.id ? await loadStaffTimesheet(user.hospitalId, user.staffProfile.id, year, month) : null;

  return (
    <AppShell title="Timesheet">
      {sheet ? (
        <TimesheetBoard
          month={monthLabel(year, month)}
          prevMonth={shiftMonth(year, month, -1)}
          nextMonth={shiftMonth(year, month, 1)}
          days={sheet.days}
          weeks={sheet.weeks}
          salary={sheet.salary}
          casualLeaveDays={sheet.casualLeaveDays}
          sickLeaveDays={sheet.sickLeaveDays}
          hasPay={sheet.hasPay}
        />
      ) : (
        <p className="text-sm text-slate-500">Your login is not linked to a staff record yet. Ask the hospital admin to link it.</p>
      )}
    </AppShell>
  );
}
