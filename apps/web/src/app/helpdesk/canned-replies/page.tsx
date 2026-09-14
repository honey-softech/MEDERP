import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HelpdeskCannedRepliesManager } from "@/components/helpdesk-canned-replies-manager";
import { getCurrentUser } from "@/lib/auth";
import { canHandleHelpdesk } from "@/lib/helpdesk";

export default async function HelpdeskCannedRepliesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canHandleHelpdesk(user.role)) redirect("/helpdesk");

  return (
    <AppShell title="Canned replies">
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        <Link href="/helpdesk" className="font-medium text-teal-700 hover:underline">
          Back to helpdesk
        </Link>
        {" · "}
        Reusable agent replies. Software admin can edit or delete any reply; agents can manage their own.
      </p>
      <HelpdeskCannedRepliesManager canEditAny={user.role === "SOFTWARE_ADMIN"} />
    </AppShell>
  );
}
