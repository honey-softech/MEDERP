import { NextResponse } from "next/server";
import type { LabActionResult } from "@/lib/lab-orders/types";

export function labActionResponse(result: LabActionResult) {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.body);
}
