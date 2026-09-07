import { NextResponse } from "next/server";
import type { BillingActionResult } from "@/lib/billing/types";

export function billingActionResponse(result: BillingActionResult) {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.body);
}
