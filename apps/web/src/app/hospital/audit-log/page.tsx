import { AppShell } from "@/components/app-shell";
import { AuditLogTable } from "@/components/audit-log-table";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function HospitalAuditLogPage() {
  const user = await getCurrentUser();
  const hospitalName = user?.hospital?.name ?? "your hospital";

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: { hospitalId: user!.hospitalId! },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.appUser.findMany({
      where: { hospitalId: user!.hospitalId! },
      select: { username: true, role: true },
      orderBy: { username: "asc" },
    }),
  ]);

  return (
    <AppShell title={`${hospitalName} audit log`}>
      <p className="mb-6 text-sm text-slate-500">
        Today's log is shown first. Filter by date, user, or role to search further.
      </p>
      <AuditLogTable logs={logs} users={users} />
    </AppShell>
  );
}
