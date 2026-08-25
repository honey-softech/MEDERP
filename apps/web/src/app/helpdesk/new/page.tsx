import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HelpdeskTicketForm } from "@/components/helpdesk-ticket-form";
import { getCurrentUser } from "@/lib/auth";

export default async function NewHelpdeskTicketPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="New helpdesk request">
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Describe the issue. Software admin and helpdesk will see it, and the hospital super admin can follow the thread.
      </p>
      <div className="max-w-xl">
        <HelpdeskTicketForm />
      </div>
    </AppShell>
  );
}
