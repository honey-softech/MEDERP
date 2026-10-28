import { NextResponse } from "next/server";
import { requireHospitalActor } from "@/lib/authz/hospital";
import { reviewTimesheetWeek } from "@/lib/timesheet";
import { addHoliday, removeHoliday, saveStaffPay, saveWeeklyOff } from "@/lib/timesheet-admin";

export async function POST(request: Request) {
  const actor = await requireHospitalActor();
  if (actor.error) return actor.error;
  if (actor.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only the hospital admin can review timesheets." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const hospitalId = actor.user.hospitalId;
  try {
    if (body?.action === "pay") {
      await saveStaffPay({
        hospitalId,
        staffId: String(body.staffId ?? ""),
        payBasis: body.payBasis === "DAILY" ? "DAILY" : "MONTHLY",
        monthlyAmount: body.monthlyAmount ? Number(body.monthlyAmount) : null,
        dailyRate: body.dailyRate ? Number(body.dailyRate) : null,
        monthDivisor: body.monthDivisor === "CALENDAR_DAYS" ? "CALENDAR_DAYS" : "FIXED_30",
        casualLeaveDays: Math.floor(Number(body.casualLeaveDays) || 0),
        sickLeaveDays: Math.floor(Number(body.sickLeaveDays) || 0),
      });
    } else if (body?.action === "weekly-off") {
      const days = Array.isArray(body.days) ? body.days.map((day) => Number(day)) : [];
      await saveWeeklyOff(hospitalId, days);
    } else if (body?.action === "holiday") {
      await addHoliday(hospitalId, String(body.date ?? ""), String(body.name ?? ""));
    } else if (body?.action === "remove-holiday") {
      await removeHoliday(hospitalId, String(body.id ?? ""));
    } else if (body?.action === "review") {
      await reviewTimesheetWeek({
        hospitalId,
        staffId: String(body.staffId ?? ""),
        weekStart: String(body.weekStart ?? ""),
        action: body.decision === "return" ? "return" : "approve",
        reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : null,
        reviewerUserId: actor.user.id,
      });
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
