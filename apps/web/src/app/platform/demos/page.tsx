import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getDemoSettings } from "@/lib/demo/settings";
import { DemoBookingActions } from "./booking-actions";

export default async function PlatformDemosPage() {
  const [settings, bookings] = await Promise.all([
    getDemoSettings(),
    prisma.demoBooking.findMany({ orderBy: { startsAt: "desc" }, take: 200 }),
  ]);

  return (
    <AppShell title="Demo bookings">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Prospect demos booked from the public calendar.</p>
        <Link href="/platform/demos/settings" className="text-sm font-medium text-teal-700 hover:underline">
          Calendar settings
        </Link>
      </div>
      {bookings.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No demo requests yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Prospect</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {booking.startsAt.toLocaleString("en-IN", {
                      timeZone: settings.timezone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{booking.name}</p>
                    <p className="text-slate-500">
                      {booking.email}
                      {booking.organization ? ` · ${booking.organization}` : ""}
                    </p>
                    {booking.meetLink ? (
                      <a className="text-teal-700 underline" href={booking.meetLink}>
                        Meet link
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{booking.status}</td>
                  <td className="px-4 py-3">
                    {booking.status === "BOOKED" ? <DemoBookingActions id={booking.id} /> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
