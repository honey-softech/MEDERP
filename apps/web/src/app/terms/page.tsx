import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, secondaryButtonClass } from "@/components/auth-shell";
import { isMobileAppRequest } from "@/lib/mobile-app";
import { getPlatformBillingSettings } from "@/lib/platform-billing";
import { DEFAULT_SUBSCRIPTION_TERMS } from "@/lib/subscription-terms";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "MedERP hospital SaaS subscription terms, monthly billing, and package changes for clinics in India.",
  alternates: { canonical: "/terms" },
  openGraph: {
    url: "/terms",
    title: "Terms & Conditions",
    description: "MedERP hospital SaaS subscription terms, monthly billing, and package changes for clinics in India.",
  },
  robots: { index: true, follow: true },
};

export default async function TermsPage() {
  const [settings, isMobileApp] = await Promise.all([getPlatformBillingSettings(), isMobileAppRequest()]);
  const body = settings.termsNote?.trim() || DEFAULT_SUBSCRIPTION_TERMS;

  return (
    <AuthShell
      wide
      backHref="/"
      title="Terms & Conditions"
      subtitle="MedERP hospital SaaS subscription, monthly auto-debit, and package changes."
    >
      <article className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        {body}
      </article>
      {isMobileApp ? null : (
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/register-hospital" className={`${secondaryButtonClass} inline-flex`}>
            Back to registration
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
