import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPublic } from "@/components/marketing-public";
import { MEDERP_PUBLIC_ORIGIN } from "@/lib/mobile-app";
import { SUBSCRIPTION_GST_PERCENT, subscriptionTotalWithGst } from "@/lib/platform-pricing";
import { EXTRA_USER_MONTHLY_FEE, SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";

export const metadata: Metadata = {
  title: "Clinic ERP pricing",
  description:
    "MedERP pricing for clinics in India. Monthly OPD plans from ₹1,200 before GST, with a 1-month free trial.",
  alternates: { canonical: "/pricing" },
  robots: { index: true, follow: true },
  openGraph: {
    url: "/pricing",
    title: "Clinic ERP pricing",
    description:
      "MedERP pricing for clinics in India. Monthly OPD plans from ₹1,200 before GST, with a 1-month free trial.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "MedERP — clinic and hospital ERP for India" }],
  },
};

function rupees(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MedERP",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${MEDERP_PUBLIC_ORIGIN}/pricing`,
  offers: SUBSCRIPTION_TIERS.map((tier) => ({
    "@type": "Offer",
    name: tier.name,
    description: `${tier.tagline}. ${tier.roleSuggestion}. Fees are before ${SUBSCRIPTION_GST_PERCENT}% GST.`,
    price: String(tier.monthlyFee),
    priceCurrency: "INR",
    url: `${MEDERP_PUBLIC_ORIGIN}/pricing`,
  })),
};

export default function PricingPage() {
  return (
    <MarketingPublic
      kicker="Clinic ERP pricing"
      title="Monthly plans for the OPD."
      lede="Every plan starts with a 1-month free trial, then a monthly fee. Prices below are before GST. An extra login beyond the included users is a flat monthly add-on."
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="grid gap-4">
        {SUBSCRIPTION_TIERS.map((tier) => (
          <article key={tier.id} className="landing-card">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1f6f62]">{tier.tagline}</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#10211e]">{tier.name}</h2>
            <p className="mt-2 text-2xl font-semibold text-[#10211e]">
              {rupees(tier.monthlyFee)}
              <span className="text-sm font-medium text-[#5c726c]"> / month before GST</span>
            </p>
            <p className="mt-1 text-sm text-[#3e5550]">{rupees(subscriptionTotalWithGst(tier.monthlyFee))} including GST</p>
            <ul className="mt-4 grid gap-1 text-sm leading-relaxed text-[#3e5550]">
              {tier.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm leading-relaxed text-[#3e5550]">
        Each extra user is {rupees(EXTRA_USER_MONTHLY_FEE)} per month before GST. Current plans cover OPD, appointments,
        nurse vitals, and billing. Register a clinic to start the trial.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/register-hospital" className="landing-cta inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
          Register clinic
        </Link>
        <Link href="/features" className="landing-ghost inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
          See features
        </Link>
      </div>
    </MarketingPublic>
  );
}
