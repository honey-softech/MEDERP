import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPublic } from "@/components/marketing-public";
import { marketingFeatures, marketingModules } from "@/lib/marketing-features";

export const metadata: Metadata = {
  title: "Clinic ERP features",
  description:
    "Clinic ERP modules for India: OPD queue, nurse vitals, doctor consult, clinic billing, WhatsApp, and staff.",
  alternates: { canonical: "/features" },
  robots: { index: true, follow: true },
  openGraph: {
    url: "/features",
    title: "Clinic ERP features",
    description:
      "Clinic ERP modules for India: OPD queue, nurse vitals, doctor consult, clinic billing, WhatsApp, and staff.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "MedERP — clinic and hospital ERP for India" }],
  },
};

export default async function FeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim().toLowerCase() ?? "";
  const modules = query
    ? marketingModules.filter((item) => `${item.title} ${item.body}`.toLowerCase().includes(query))
    : marketingModules;
  const guides = query
    ? marketingFeatures.filter((feature) =>
        `${feature.title} ${feature.keyword} ${feature.summary}`.toLowerCase().includes(query),
      )
    : marketingFeatures;

  return (
    <MarketingPublic
      kicker="Clinic ERP"
      title="The modules of a clinic day."
      lede="MedERP is clinic ERP for India. Reception, the nurse, and the doctor share one patient record from the token to the bill."
    >
      {query ? (
        <p className="mb-6 text-sm text-[#3e5550]">
          Results for “{q?.trim()}”.{" "}
          <Link href="/features" className="font-semibold text-[#10211e] underline">
            Show every module
          </Link>
        </p>
      ) : null}
      {modules.length === 0 ? (
        <p className="text-sm leading-relaxed text-[#3e5550]">
          No module matched that search.{" "}
          <Link href="/features" className="font-semibold text-[#10211e] underline">
            Browse every module
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-4">
          {modules.map((item) => (
            <article key={item.title} className="landing-card">
              <h2 className="text-lg font-semibold tracking-tight text-[#10211e]">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#3e5550]">{item.body}</p>
            </article>
          ))}
        </div>
      )}
      <div className="mt-10 grid gap-4">
        {guides.map((feature) => (
          <Link key={feature.slug} href={`/features/${feature.slug}`} className="landing-card block hover:border-[#10211e]/20">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1f6f62]">{feature.keyword}</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-[#10211e]">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#3e5550]">{feature.summary}</p>
          </Link>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/pricing" className="landing-ghost inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
          See pricing
        </Link>
        <Link href="/demo" className="landing-cta inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
          Book a demo
        </Link>
      </div>
    </MarketingPublic>
  );
}
