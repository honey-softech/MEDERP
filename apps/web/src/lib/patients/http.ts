import { NextResponse } from "next/server";
import type { PatientActionResult } from "@/lib/patients/types";

export function patientActionResponse(result: PatientActionResult) {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.body);
}
