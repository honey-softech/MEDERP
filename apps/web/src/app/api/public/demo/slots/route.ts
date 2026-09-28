import { NextResponse } from "next/server";
import { DemoError, listSlotsForDate } from "@/lib/demo/bookings";
import { clientIp, rateLimit } from "@/lib/demo/rate-limit";

export async function GET(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`slots:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  const date = new URL(request.url).searchParams.get("date") ?? "";
  try {
    return NextResponse.json(await listSlotsForDate(date));
  } catch (error) {
    if (error instanceof DemoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
