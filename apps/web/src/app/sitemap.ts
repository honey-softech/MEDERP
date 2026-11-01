import type { MetadataRoute } from "next";
import { MEDERP_PUBLIC_ORIGIN } from "@/lib/mobile-app";

const lastModified = new Date("2026-11-01");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }[] = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/features", changeFrequency: "weekly", priority: 0.9 },
    { path: "/features/opd", changeFrequency: "monthly", priority: 0.8 },
    { path: "/features/billing", changeFrequency: "monthly", priority: 0.8 },
    { path: "/features/whatsapp", changeFrequency: "monthly", priority: 0.8 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
    { path: "/demo", changeFrequency: "monthly", priority: 0.8 },
    { path: "/register-hospital", changeFrequency: "monthly", priority: 0.8 },
    { path: "/help", changeFrequency: "monthly", priority: 0.5 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  ];

  return pages.map((page) => ({
    url: `${MEDERP_PUBLIC_ORIGIN}${page.path}`,
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
