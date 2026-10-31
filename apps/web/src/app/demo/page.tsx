import type { Metadata } from "next";
import { DemoBookForm } from "./demo-book-form";

export const metadata: Metadata = {
  title: "Book a MedERP demo",
  description:
    "Book a walkthrough of MedERP, clinic and hospital ERP for India, including OPD management, billing, and WhatsApp.",
  alternates: { canonical: "/demo" },
  openGraph: {
    url: "/demo",
    title: "Book a MedERP demo",
    description:
      "Book a walkthrough of MedERP, clinic and hospital ERP for India, including OPD management, billing, and WhatsApp.",
  },
  robots: { index: true, follow: true },
};

export default function DemoPage() {
  return <DemoBookForm />;
}
