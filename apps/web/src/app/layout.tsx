import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedERP — Hospital ERP",
  description: "Hospital ERP for web and mobile: patients, appointments, billing, pharmacy, and lab.",
};

// App pages load hospital data at runtime; skip build-time prerender (no DB in Docker build).
export const dynamic = "force-dynamic";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-app-bg font-sans text-text-primary">{children}</body>
    </html>
  );
}
