import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeaveReviewActions } from "@/components/leave-review-actions";
import { getCurrentUser } from "@/lib/auth";
import { prettyEnum } from "@/lib/front-desk";
import { staffDisplayName } from "@/lib/staff-leave";
import { prisma } from "@/lib/prisma";

export default async function HospitalLeavesPage() {
  const user = await getCurrentUser();
  if (!user?.hospitalId || user.role !== "SUPER_ADMIN") redirect("/");

  const leaves = await prisma.staffLeave.findMany({
    where: { hospitalId: user.hospitalId },
    include: { staff: { include: { appUser: { select: { username: true } } } } },
    orderBy: [{ status: "asc" }, { startAt: "desc" }],
    take: 200,
  });

  const pending = leaves.filter((item) => item.status === "PENDING");
  const others = leaves.filter((item) => item.status !== "PENDING");

  return (
    <AppShell title="Staff leave">
      <p className="mb-6 text-sm text-slate-500">
        Doctors, nurses, receptionists, and other hospital staff apply from Leave. A requested or approved doctor leave
        blocks walk-in and pre-booked appointments for those days. If you reject the request, booking opens again.
      </p>
      {pending.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No pending leave requests.</p>
      ) : (
        <div className="grid gap-4">
          {pending.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="font-semibold">
                  {staffDisplayName(item.staff)} · {prettyEnum(item.staff.role)}
                </p>
                <p className="text-sm text-slate-500">
                  {prettyEnum(item.type)} · {item.startAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{" "}
                  – {item.endAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {item.reason ? <p className="mt-2 text-sm text-slate-600">{item.reason}</p> : null}
              </div>
              <LeaveReviewActions leaveId={item.id} canCancel />
            </article>
          ))}
        </div>
      )}
      {others.length > 0 ? (
        <section className="mt-8">
          <h3 className="mb-3 font-semibold">Earlier leave</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {others.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                {staffDisplayName(item.staff)} · {prettyEnum(item.staff.role)} · {prettyEnum(item.type)} ·{" "}
                {prettyEnum(item.status)} · {item.startAt.toLocaleDateString("en-IN")} – {item.endAt.toLocaleDateString("en-IN")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
