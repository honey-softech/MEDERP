import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CancelJoinButton, JoinHospitalForm } from "@/components/join-hospital-form";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function JoinHospitalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isPlatformRole(user.role)) redirect("/");
  if (user.hospitalId) redirect("/");

  const [hospitals, requests] = await Promise.all([
    prisma.hospital.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, address: true, phone: true },
    }),
    prisma.hospitalJoinRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { hospital: { select: { name: true, code: true } } },
    }),
  ]);

  return (
    <AppShell title="Join a hospital">
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        You can only join a hospital that is already listed. Send a request — the hospital super admin
        must approve it before you can work there. You cannot add yourself to a hospital directly.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <JoinHospitalForm hospitals={hospitals} defaultRole={user.role} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Your requests</h3>
          {requests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No join requests yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {requests.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-100 p-3">
                  <p className="font-medium">
                    {item.hospital.name}{" "}
                    <span className="font-mono text-xs text-slate-500">({item.hospital.code})</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.requestedRole.replace(/_/g, " ")} · {item.status.toLowerCase()}
                  </p>
                  {item.reviewNote ? <p className="mt-1 text-xs text-slate-500">{item.reviewNote}</p> : null}
                  {item.status === "PENDING" ? (
                    <div className="mt-3">
                      <CancelJoinButton requestId={item.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
