import type { MetadataRoute } from "next";
import { MEDERP_PUBLIC_ORIGIN } from "@/lib/mobile-app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/hospital/",
        "/platform/",
        "/patients/",
        "/billing/",
        "/appointments/",
        "/lab/",
        "/pharmacy/",
        "/wards/",
        "/helpdesk/",
        "/queue",
        "/nurse",
        "/staff",
        "/board",
        "/timesheet",
        "/leave",
        "/account",
      ],
    },
    sitemap: `${MEDERP_PUBLIC_ORIGIN}/sitemap.xml`,
  };
}
