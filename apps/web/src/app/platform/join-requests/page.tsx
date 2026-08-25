import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { JoinRequestActions } from "@/components/join-request-actions";
import { prisma } from "@/lib/prisma";

export default async function PlatformJoinRequestsPage() {
  const requests = await prisma.hospitalJoinRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { username: true, mobile: true } },
      hospital: { select: { name: true, code: true } },
    },
  });

  return (
    <AppShell title="Join requests">
      <p className="mb-6 text-sm text-slate-500">
        Staff signup requests to join a listed hospital appear here. For hospital support issues (slow app,
        login problems), open <Link href="/helpdesk" className="font-medium text-teal-700 hover:underline">Helpdesk</Link>{" "}
        — those are separate tickets.
      </p>
      {requests.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No pending join requests.
        </p>
      ) : (
        <div className="grid gap-4">
          {requests.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="font-semibold">{item.user.username}</p>
                <p className="text-sm text-slate-500">
                  {item.user.mobile} · {item.hospital.name} ({item.hospital.code}) ·{" "}
                  {item.requestedRole.replace(/_/g, " ").toLowerCase()}
                </p>
                {item.note ? <p className="mt-2 text-sm text-slate-600">{item.note}</p> : null}
              </div>
              <JoinRequestActions requestId={item.id} defaultRole={item.requestedRole} />
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
