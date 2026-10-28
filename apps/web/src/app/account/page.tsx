import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AccountPanel } from "@/components/account-panel";
import { selfServiceBlockReason } from "@/lib/account-lifecycle";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";
import { personLabel } from "@/lib/display";
import { cardClass } from "@/lib/ui";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (isPlatformRole(user.role)) {
    return (
      <AppShell title="Account">
        <section className={`${cardClass} max-w-xl p-5 text-sm text-text-secondary`}>
          Platform accounts are managed from the software console.
        </section>
      </AppShell>
    );
  }

  const blocked = await selfServiceBlockReason(user);
  const name = personLabel({
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.role,
    staffRole: user.staffProfile?.role,
  });
  const hospitalLabel = user.hospital ? `${user.hospital.name} · ${user.hospital.code}` : null;

  return (
    <AppShell title="Account">
      <AccountPanel
        name={name}
        roleLabel={user.role.replace(/_/g, " ")}
        mobile={user.mobile}
        hospitalLabel={hospitalLabel}
        canLeave={Boolean(user.hospitalId)}
        blockedReason={blocked}
      />
    </AppShell>
  );
}
