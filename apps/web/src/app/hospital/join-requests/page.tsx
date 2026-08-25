import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { JoinRequestActions } from "@/components/join-request-actions";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function HospitalJoinRequestsPage() {
  const user = await getCurrentUser();
  if (!user?.hospitalId || user.role !== "SUPER_ADMIN") redirect("/");

  const requests = await prisma.hospitalJoinRequest.findMany({
    where: { hospitalId: user.hospitalId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      user: { select: { username: true, mobile: true } },
    },
  });

  const pending = requests.filter((item) => item.status === "PENDING");
  const others = requests.filter((item) => item.status !== "PENDING");

  return (
    <AppShell title="Join requests">
      <p className="mb-6 text-sm text-slate-500">
        Staff can sign up on their own, but they only join this hospital after you approve them.
      </p>
      {pending.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No pending join requests.
        </p>
      ) : (
        <div className="grid gap-4">
          {pending.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="font-semibold">{item.user.username}</p>
                <p className="text-sm text-slate-500">
                  {item.user.mobile} · requested {item.requestedRole.replace(/_/g, " ").toLowerCase()}
                </p>
                {item.note ? <p className="mt-2 text-sm text-slate-600">{item.note}</p> : null}
              </div>
              <JoinRequestActions requestId={item.id} defaultRole={item.requestedRole} />
            </article>
          ))}
        </div>
      )}
      {others.length > 0 ? (
        <section className="mt-8">
          <h3 className="mb-3 font-semibold">Earlier requests</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {others.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                {item.user.username} · {item.status.toLowerCase()} · {item.requestedRole.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
