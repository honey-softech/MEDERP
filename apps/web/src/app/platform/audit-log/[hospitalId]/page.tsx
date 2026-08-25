import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuditLogTable } from "@/components/audit-log-table";
import { prisma } from "@/lib/prisma";

export default async function HospitalAuditLogForSaasPage({
  params,
}: {
  params: Promise<{ hospitalId: string }>;
}) {
  const { hospitalId } = await params;
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { id: true, name: true, code: true },
  });

  if (!hospital) notFound();

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: { hospitalId: hospital.id },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.appUser.findMany({
      where: { hospitalId: hospital.id },
      select: { username: true, role: true },
      orderBy: { username: "asc" },
    }),
  ]);

  return (
    <AppShell title={`${hospital.name} audit log`}>
      <p className="mb-6 text-sm text-slate-500">
        <Link className="text-teal-700 hover:underline" href="/platform/audit-log">
          Select hospital
        </Link>
        {" · "}
        Filter by date, user, or role, then search. Logs are for {hospital.name} ({hospital.code}) only.
      </p>
      <AuditLogTable logs={logs} users={users} />
    </AppShell>
  );
}
