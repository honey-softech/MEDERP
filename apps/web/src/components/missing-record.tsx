import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { secondaryButtonClass } from "@/components/auth-shell";

export function MissingRecord({
  title,
  backHref,
  backLabel,
}: {
  title: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <AppShell title={title}>
      <p className="max-w-xl text-sm text-slate-600">
        This record is not available for the hospital you are signed into. Open it from the list, or go back.
      </p>
      <Link href={backHref} className={`${secondaryButtonClass} mt-4 inline-flex`}>
        {backLabel}
      </Link>
    </AppShell>
  );
}
