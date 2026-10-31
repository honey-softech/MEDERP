import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedERP - Clinic & Hospital ERP",
    short_name: "MedERP",
    description: "Clinic and hospital ERP for India: OPD, billing, pharmacy, lab, and WhatsApp.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#10211e",
    icons: [
      { src: "/mederp-icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/mederp-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/mederp-icon.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/mederp-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
