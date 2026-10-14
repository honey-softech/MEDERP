import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OtpDangerAction } from "@/components/otp-danger-action";
import { selfServiceBlockReason } from "@/lib/account-lifecycle";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (isPlatformRole(user.role)) {
    return (
      <AppShell title="Account">
        <p className="text-sm text-slate-600">Platform accounts are managed from the software console.</p>
      </AppShell>
    );
  }

  const blocked = await selfServiceBlockReason(user);

  return (
    <AppShell title="Account">
      <p className="max-w-2xl text-sm text-slate-600">
        Leave this hospital and keep your login, or delete the account so this mobile number can be registered again.
        Both steps use the same WhatsApp login OTP.
      </p>
      {user.hospitalId ? (
        <OtpDangerAction
          title="Leave hospital"
          description="Your login stays active. After you sign in again you can request to join another hospital. Your staff profile stays on file at this hospital."
          sendUrl="/api/account/leave-hospital/otp"
          confirmUrl="/api/account/leave-hospital"
          confirmLabel="Leave hospital"
          disabled={Boolean(blocked)}
          disabledReason={blocked ?? undefined}
        />
      ) : (
        <p className="mt-4 text-sm text-slate-500">This login is not linked to a hospital.</p>
      )}
      <OtpDangerAction
        title="Delete account"
        description="Your login is closed and this mobile number can be used to sign up again. Clinical records already filed at a hospital stay on file."
        sendUrl="/api/account/delete/otp"
        confirmUrl="/api/account/delete"
        confirmLabel="Delete account"
        disabled={Boolean(blocked)}
        disabledReason={blocked ?? undefined}
      />
    </AppShell>
  );
}
