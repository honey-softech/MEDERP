import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help",
  description: "Contact MedERP support for clinic ERP, OPD, billing, and WhatsApp questions.",
  alternates: { canonical: "/help" },
  openGraph: {
    url: "/help",
    title: "Help",
    description: "Contact MedERP support for clinic ERP, OPD, billing, and WhatsApp questions.",
  },
  robots: { index: true, follow: true },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
