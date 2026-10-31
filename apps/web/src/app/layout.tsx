import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { MEDERP_PUBLIC_ORIGIN } from "@/lib/mobile-app";
import "./globals.css";

const siteTitle = "MedERP — Clinic & Hospital ERP for India";
const siteDescription =
  "Clinic and hospital ERP for India: OPD management software for the queue, nurse vitals, doctor consult, clinic billing, pharmacy, lab, and WhatsApp — on the web and in the staff app.";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(MEDERP_PUBLIC_ORIGIN),
  title: {
    default: siteTitle,
    template: "%s · MedERP",
  },
  description: siteDescription,
  keywords: [
    "MedERP",
    "clinic ERP India",
    "hospital ERP India",
    "OPD management software",
    "clinic OPD software",
    "clinic billing software",
    "pharmacy software",
    "lab software",
    "clinic software with WhatsApp",
  ],
  openGraph: {
    type: "website",
    siteName: "MedERP",
    title: siteTitle,
    description: siteDescription,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: false,
    follow: false,
  },
  verification: {
    google: "6iti9iTP9D8-2SfejfQy-ElG0U2Mr66Ile1GnR2-B7k",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/mederp-icon.png", type: "image/png", sizes: "1024x1024" },
    ],
    apple: [{ url: "/mederp-icon.png", sizes: "180x180" }],
  },
  applicationName: "MedERP",
};

// App pages load hospital data at runtime; skip build-time prerender (no DB in Docker build).
export const dynamic = "force-dynamic";

// Pinch / double-tap zoom is off so the installed iOS and Android builds fit
// the screen like an app instead of a zoomable web page.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10211e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-app-bg font-sans text-text-primary">{children}</body>
    </html>
  );
}
