import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/demo/bookings";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });
  const booking = await getBookingByToken(token);
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  return NextResponse.json(booking);
}
