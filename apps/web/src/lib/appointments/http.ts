import { NextResponse } from "next/server";
import type { AppointmentActionResult } from "@/lib/appointments/types";

export function appointmentActionResponse(result: AppointmentActionResult) {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.body);
}
