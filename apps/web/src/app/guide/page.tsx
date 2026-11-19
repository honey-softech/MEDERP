import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { GUIDE_ROLES, GUIDES, guideRoleForUser, type GuideRole } from "@/lib/guide-content";
import { cardClass } from "@/lib/ui";
import { resolveViewContext } from "@/lib/view-mode";

function isGuideRole(value: string | undefined): value is GuideRole {
  return value === "admin" || value === "doctor" || value === "receptionist" || value === "nurse";
}

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const view = await resolveViewContext(user);
  const doctorView = view.canActAsDoctor && view.mode === "doctor";
  const canSwitch = user.role === "SUPER_ADMIN";
  const requested = (await searchParams).role;
  const role = canSwitch && isGuideRole(requested) ? requested : guideRoleForUser(user.role, doctorView);
  const guide = GUIDES[role];

  return (
    <AppShell title="User guide">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {canSwitch ? (
          <div className="flex flex-wrap gap-2">
            {GUIDE_ROLES.map((item) => (
              <Link
                key={item.id}
                href={item.id === "admin" ? "/guide" : `/guide?role=${item.id}`}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  item.id === role
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}

        <section className={`${cardClass} p-5 sm:p-6`}>
          <h3 className="text-lg font-semibold text-text-primary">{guide.title}</h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{guide.intro}</p>
        </section>

        {guide.blocks.map((block) => (
          <section key={block.heading} className={`${cardClass} p-5 sm:p-6`}>
            <h3 className="text-base font-semibold text-text-primary">{block.heading}</h3>
            <div className="mt-2 space-y-2">
              {block.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-6 text-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
