import type { MetadataRoute } from "next";
import { MEDERP_PUBLIC_ORIGIN } from "@/lib/mobile-app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: MEDERP_PUBLIC_ORIGIN,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${MEDERP_PUBLIC_ORIGIN}/demo`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${MEDERP_PUBLIC_ORIGIN}/register-hospital`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${MEDERP_PUBLIC_ORIGIN}/help`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${MEDERP_PUBLIC_ORIGIN}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${MEDERP_PUBLIC_ORIGIN}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
