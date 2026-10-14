"use client";

import { useState } from "react";
import { OtpDangerAction } from "@/components/otp-danger-action";
import { cardClass, statusBadge, statusBadgeBase } from "@/lib/ui";

export function AccountPanel({
  name,
  roleLabel,
  mobile,
  hospitalLabel,
  canLeave,
  blockedReason,
}: {
  name: string;
  roleLabel: string;
  mobile: string;
  hospitalLabel: string | null;
  canLeave: boolean;
  blockedReason: string | null;
}) {
  const [open, setOpen] = useState<"leave" | "deactivate" | null>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <section className={`${cardClass} flex items-center gap-4 p-4 sm:p-5`}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-light text-lg font-semibold text-primary-dark">
          {initial}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-text-primary">{name}</h3>
          <p className="mt-0.5 truncate text-sm text-text-secondary">{mobile}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`${statusBadgeBase} ${statusBadge.info}`}>{roleLabel}</span>
            <span className={`${statusBadgeBase} ${hospitalLabel ? statusBadge.health : statusBadge.neutral}`}>
              {hospitalLabel ?? "No hospital"}
            </span>
          </div>
        </div>
      </section>

      <section className={`${cardClass} divide-y divide-border overflow-hidden`}>
        {canLeave ? (
          <OtpDangerAction
            grouped
            title="Leave hospital"
            description="Your login stays active. After you sign in again you can request to join another hospital. Your staff profile stays on file at this hospital."
            sendUrl="/api/account/leave-hospital/otp"
            confirmUrl="/api/account/leave-hospital"
            confirmLabel="Leave hospital"
            disabled={Boolean(blockedReason)}
            disabledReason={blockedReason ?? undefined}
            open={open === "leave"}
            onOpenChange={(next) => setOpen(next ? "leave" : null)}
          />
        ) : null}
        <OtpDangerAction
          grouped
          title="Deactivate account"
          description="Your login is closed and this mobile number can be used to sign up again. Clinical records already filed at a hospital stay on file."
          sendUrl="/api/account/delete/otp"
          confirmUrl="/api/account/delete"
          confirmLabel="Deactivate account"
          disabled={Boolean(blockedReason)}
          disabledReason={blockedReason ?? undefined}
          open={open === "deactivate"}
          onOpenChange={(next) => setOpen(next ? "deactivate" : null)}
        />
      </section>
    </div>
  );
}
