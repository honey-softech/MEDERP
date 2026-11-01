import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPublic } from "@/components/marketing-public";
import { MEDERP_PUBLIC_ORIGIN } from "@/lib/mobile-app";
import { featureBySlug, type MarketingFeature } from "@/lib/marketing-features";

export function featureMetadata(slug: MarketingFeature["slug"]): Metadata {
  const feature = featureBySlug(slug);
  if (!feature) return {};
  return {
    title: feature.title,
    description: feature.summary,
    alternates: { canonical: `/features/${feature.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      url: `/features/${feature.slug}`,
      title: feature.title,
      description: feature.summary,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "MedERP — clinic and hospital ERP for India" }],
    },
  };
}

export function FeatureArticle({ slug }: { slug: MarketingFeature["slug"] }) {
  const feature = featureBySlug(slug);
  if (!feature) return null;
  const url = `${MEDERP_PUBLIC_ORIGIN}/features/${feature.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: feature.title,
        description: feature.summary,
        url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: MEDERP_PUBLIC_ORIGIN },
          { "@type": "ListItem", position: 2, name: "Features", item: `${MEDERP_PUBLIC_ORIGIN}/features` },
          { "@type": "ListItem", position: 3, name: feature.keyword, item: url },
        ],
      },
    ],
  };

  return (
    <MarketingPublic kicker={feature.keyword} title={feature.title} lede={feature.summary}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="grid gap-4">
        {feature.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-base leading-relaxed text-[#3e5550]">
            {paragraph}
          </p>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/features" className="landing-ghost inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
          All features
        </Link>
        <Link href="/demo" className="landing-cta inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
          Book a demo
        </Link>
        <Link href="/register-hospital" className="landing-ghost inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
          Register clinic
        </Link>
      </div>
    </MarketingPublic>
  );
}
