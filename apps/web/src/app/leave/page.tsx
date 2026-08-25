import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeaveApplyForm } from "@/components/leave-apply-form";
import { LeaveCancelButton } from "@/components/leave-cancel-button";
import { prettyEnum, requireHospitalPage } from "@/lib/front-desk";
import { canApplyLeave, staffDisplayName } from "@/lib/staff-leave";
import { prisma } from "@/lib/prisma";

export default async function MyLeavePage() {
  const user = await requireHospitalPage();
  if (!canApplyLeave(user.role)) redirect("/");

  const leaves = await prisma.staffLeave.findMany({
    where: {
      hospitalId: user.hospitalId,
      OR: [{ requestedByUserId: user.id }, { staff: { appUserId: user.id } }],
    },
    include: { staff: { include: { appUser: { select: { username: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <AppShell title="Leave">
      <p className="mb-6 text-sm text-slate-500">
        Apply for leave. The hospital super admin approves or rejects the request. Approved doctor leave blocks OPD
        booking for that period.
      </p>
      <LeaveApplyForm />
      <section className="mt-8">
        <h3 className="mb-3 font-semibold">Your requests</h3>
        {leaves.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No leave requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {leaves.map((leave) => (
              <li key={leave.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {prettyEnum(leave.type)} · {prettyEnum(leave.status)}
                  </p>
                  {leave.status === "PENDING" ? <LeaveCancelButton leaveId={leave.id} /> : null}
                </div>
                <p className="mt-1 text-slate-600">
                  {staffDisplayName(leave.staff)} ·{" "}
                  {leave.startAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} –{" "}
                  {leave.endAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {leave.reason ? <p className="mt-1 text-slate-500">{leave.reason}</p> : null}
                {leave.reviewNote ? <p className="mt-1 text-slate-500">Note: {leave.reviewNote}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
