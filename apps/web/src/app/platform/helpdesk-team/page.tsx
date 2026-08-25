import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { HelpdeskAgentForm } from "@/components/helpdesk-agent-form";
import { prisma } from "@/lib/prisma";

export default async function HelpdeskTeamPage() {
  const agents = await prisma.appUser.findMany({
    where: { role: "HELPDESK" },
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, mobile: true, isActive: true, isVerified: true, createdAt: true },
  });

  return (
    <AppShell title="Helpdesk team">
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Helpdesk agents handle hospital requests. They see every ticket and their replies push a live
        notification to the hospital super admin.
      </p>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <HelpdeskAgentForm />
        <FilterableTable
          empty="No helpdesk agents yet."
          rows={agents.map((agent) => ({
            id: agent.id,
            username: agent.username,
            mobile: agent.mobile,
            status: agent.isActive === false ? "Inactive" : agent.isVerified ? "Active" : "Pending",
            created: agent.createdAt.toLocaleDateString("en-IN"),
          }))}
          columns={[
            { key: "username", header: "Username", className: "font-medium" },
            { key: "mobile", header: "Mobile" },
            { key: "status", header: "Status" },
            { key: "created", header: "Added" },
          ]}
        />
      </div>
    </AppShell>
  );
}
