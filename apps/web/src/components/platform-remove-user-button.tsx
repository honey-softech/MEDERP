"use client";

import { SoftwareAdminPasswordConfirm } from "@/components/software-admin-password-confirm";

export function PlatformRemoveUserButton({
  userId,
  label,
  redirectTo,
  cancelsSubscription = false,
}: {
  userId: string;
  label: string;
  redirectTo?: string;
  cancelsSubscription?: boolean;
}) {
  return (
    <SoftwareAdminPasswordConfirm
      openLabel="Remove"
      confirmLabel="Remove account"
      description={
        cancelsSubscription
          ? `Remove account "${label}". If this is the hospital's only super admin, the Razorpay subscription is cancelled and no further charges are taken. They are signed out and this mobile can sign up again. Enter your software admin password to confirm.`
          : `Remove account "${label}". They are signed out and this mobile can sign up again. Enter your software admin password to confirm.`
      }
      onConfirm={async (password) => {
        const response = await fetch(`/api/platform/users/${userId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) return { ok: false, error: data.error ?? "Could not remove account." };
        return { ok: true, redirectTo };
      }}
    />
  );
}
