import { NextResponse } from "next/server";
import { bookDemo, DemoError } from "@/lib/demo/bookings";
import { clientIp, rateLimit } from "@/lib/demo/rate-limit";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`book:${ip}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many booking attempts. Try again later." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  const email = String(body.email ?? "").trim().toLowerCase();
  if (email && !rateLimit(`book-email:${email}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many bookings for this email. Try again later." }, { status: 429 });
  }
  try {
    const booking = await bookDemo({
      name: String(body.name ?? ""),
      email,
      phone: body.phone != null ? String(body.phone) : null,
      organization: body.organization != null ? String(body.organization) : null,
      notes: body.notes != null ? String(body.notes) : null,
      startsAt: String(body.startsAt ?? ""),
    });
    return NextResponse.json(booking);
  } catch (error) {
    if (error instanceof DemoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
