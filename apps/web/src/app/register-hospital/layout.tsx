import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register your clinic",
  description:
    "Register a clinic on MedERP, hospital ERP for India, and start a trial with OPD management, billing, and WhatsApp.",
  alternates: { canonical: "/register-hospital" },
  openGraph: {
    url: "/register-hospital",
    title: "Register your clinic",
    description:
      "Register a clinic on MedERP, hospital ERP for India, and start a trial with OPD management, billing, and WhatsApp.",
  },
  robots: { index: true, follow: true },
};

export default function RegisterHospitalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
