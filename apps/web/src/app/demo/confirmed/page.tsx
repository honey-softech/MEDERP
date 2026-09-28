import Link from "next/link";
import { AuthShell, secondaryButtonClass } from "@/components/auth-shell";
import { getBookingByToken } from "@/lib/demo/bookings";

export default async function DemoConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; mail?: string; mailError?: string }>;
}) {
  const { token } = await searchParams;
  const booking = token ? await getBookingByToken(token) : null;

  return (
    <AuthShell title="Demo booked" subtitle={booking ? booking.label : "We could not find that booking."}>
      {booking ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            {booking.name}, your demo is {booking.status === "BOOKED" ? "confirmed" : booking.status.toLowerCase()}.
          </p>
          {booking.meetLink ? (
            <p>
              Meet link:{" "}
              <a className="font-medium text-teal-700 underline" href={booking.meetLink}>
                {booking.meetLink}
              </a>
            </p>
          ) : (
            <p>Open the calendar invite from Google for this demo, or download the calendar file below.</p>
          )}
          <p>
            Google Calendar sends the invite (and Meet link) to <span className="font-medium">{booking.email}</span>.
            Check inbox and spam.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <a className={secondaryButtonClass} href={`/api/public/demo/ics?token=${encodeURIComponent(token ?? "")}`}>
              Download calendar file
            </a>
            {booking.status === "BOOKED" ? (
              <Link className={secondaryButtonClass} href={`/demo/cancel?token=${encodeURIComponent(token ?? "")}`}>
                Cancel demo
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <Link className={secondaryButtonClass} href="/demo">
          Book a demo
        </Link>
      )}
    </AuthShell>
  );
}
