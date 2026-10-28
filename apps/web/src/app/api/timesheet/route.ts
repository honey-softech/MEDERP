import { NextResponse } from "next/server";
import type { TimesheetDayKind } from "@prisma/client";
import { requireHospitalActor } from "@/lib/authz/hospital";
import { canFillTimesheet, saveTimesheetDay, submitTimesheetWeek } from "@/lib/timesheet";

const KINDS = new Set<TimesheetDayKind>(["WORKED", "HALF_DAY", "CASUAL_LEAVE", "SICK_LEAVE", "ABSENT"]);

export async function POST(request: Request) {
  const actor = await requireHospitalActor();
  if (actor.error) return actor.error;
  const user = actor.user;
  if (!canFillTimesheet(user.role) || !user.staffProfile?.id) {
    return NextResponse.json({ error: "Timesheets are for clinic staff." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    date?: string;
    kind?: TimesheetDayKind;
    clockIn?: string;
    clockOut?: string;
    note?: string;
    weekStart?: string;
  } | null;
  try {
    if (body?.action === "day") {
      if (!body.date || !body.kind || !KINDS.has(body.kind)) {
        return NextResponse.json({ error: "Choose how this day was spent." }, { status: 400 });
      }
      await saveTimesheetDay({
        hospitalId: user.hospitalId,
        staffId: user.staffProfile.id,
        date: body.date,
        kind: body.kind,
        clockIn: body.clockIn,
        clockOut: body.clockOut,
        note: body.note,
      });
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "submit" && body.weekStart) {
      await submitTimesheetWeek(user.hospitalId, user.staffProfile.id, body.weekStart);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the timesheet.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
