import Link from "next/link";
import { AuthShell, secondaryButtonClass } from "@/components/auth-shell";
import { getBookingByToken } from "@/lib/demo/bookings";

export default async function DemoConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; mail?: string }>;
}) {
  const { token, mail } = await searchParams;
  const booking = token ? await getBookingByToken(token) : null;
  const mailStatus = mail === "skipped" || mail === "failed" || mail === "sent" ? mail : "sent";

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
            <p>Google Meet link was not created. Check the calendar event on the connected Google account.</p>
          )}
          {mailStatus === "sent" ? (
            <p>A calendar invite was emailed to {booking.email}.</p>
          ) : mailStatus === "skipped" ? (
            <p className="text-amber-800">
              MedERP email is not configured yet (needs RESEND_API_KEY). Google should still email the calendar/Meet
              invite to {booking.email} — check spam, or use the Meet link above.
            </p>
          ) : (
            <p className="text-amber-800">
              Could not send the MedERP confirmation email to {booking.email}. Use the Meet link above if Google did not
              send an invite.
            </p>
          )}
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
