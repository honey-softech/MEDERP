import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDemoIcs } from "@/lib/demo/ics";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const booking = token ? await prisma.demoBooking.findUnique({ where: { cancelToken: token } }) : null;
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const ics = buildDemoIcs({
    uid: booking.id,
    start: booking.startsAt,
    end: booking.endsAt,
    summary: booking.status === "CANCELLED" ? "Cancelled: MedERP product demo" : "MedERP product demo",
    description: `Demo for ${booking.name}`,
    method: booking.status === "CANCELLED" ? "CANCEL" : "PUBLISH",
    meetLink: booking.meetLink,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mederp-demo.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
