import { NextResponse } from "next/server";
import { cancelDemoByToken, DemoError } from "@/lib/demo/bookings";
import { clientIp, rateLimit } from "@/lib/demo/rate-limit";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`cancel:${ip}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "");
  try {
    return NextResponse.json(await cancelDemoByToken(token));
  } catch (error) {
    if (error instanceof DemoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
