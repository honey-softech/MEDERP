import Image from "next/image";
import Link from "next/link";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { DeveloperCredit, ManagedByCredit } from "@/components/auth-branding";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-landing-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-landing-body",
});

type FeatureIcon =
  | "opd"
  | "nurse"
  | "doctor"
  | "patients"
  | "billing"
  | "certificate"
  | "whatsapp"
  | "staff"
  | "admin";

const features: { title: string; body: string; icon: FeatureIcon }[] = [
  {
    title: "OPD & front desk",
    body: "Patient registration, appointments, walk-ins, tokens, and the daily OPD queue for reception.",
    icon: "opd",
  },
  {
    title: "Nurse station & vitals",
    body: "Dedicated nurse worklist to record vitals before the doctor starts the consult.",
    icon: "nurse",
  },
  {
    title: "Doctor consult",
    body: "Visit assessment, diagnosis, prescription, investigations, and printable visit summaries.",
    icon: "doctor",
  },
  {
    title: "Patients & history",
    body: "Full patient chart with past visits, reports, follow-ups, and family grouping.",
    icon: "patients",
  },
  {
    title: "Billing & collections",
    body: "OPD invoices, payments, advances, collection reports, and printable receipts.",
    icon: "billing",
  },
  {
    title: "Medical certificates",
    body: "Issue sick leave, fitness, and general certificates from the visit workflow.",
    icon: "certificate",
  },
  // Pharmacy, Laboratory, Wards / IPD — add back on the landing when we market those modules.
  {
    title: "WhatsApp & mobile",
    body: "Send visit summaries, bills, and reminders on WhatsApp. Staff app for the same clinic on mobile.",
    icon: "whatsapp",
  },
  {
    title: "Staff & leave",
    body: "Role-based seats for doctors, nurses, and reception, plus leave requests and approvals.",
    icon: "staff",
  },
  {
    title: "Admin & support",
    body: "Hospital settings, audit log, helpdesk tickets, and subscription plans with a free trial.",
    icon: "admin",
  },
];

function FeatureIconSvg({ name }: { name: FeatureIcon }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "opd":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 2v4M16 2v4M8 14h3M13 14h3M8 17h8" />
        </svg>
      );
    case "nurse":
      return (
        <svg {...common}>
          <path d="M12 3v6M9 6h6" />
          <circle cx="12" cy="14" r="3" />
          <path d="M6 21c1.2-3 3.4-4.5 6-4.5S16.8 18 18 21" />
        </svg>
      );
    case "doctor":
      return (
        <svg {...common}>
          <path d="M8 4v5a4 4 0 0 0 8 0V4" />
          <path d="M8 4c0-1 .8-2 2-2h1M16 4c0-1-.8-2-2-2h-1" />
          <path d="M12 13v3a3 3 0 1 0 3-3" />
          <circle cx="17" cy="16" r="2" />
        </svg>
      );
    case "patients":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c.8-3.2 2.8-5 6-5s5.2 1.8 6 5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M15 20c.4-1.8 1.4-3 3-3s2.4 1 3 2.5" />
        </svg>
      );
    case "billing":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "certificate":
      return (
        <svg {...common}>
          <path d="M7 3h8l4 4v14H7V3Z" />
          <path d="M15 3v4h4M9 12h6M9 16h4" />
          <circle cx="15.5" cy="17.5" r="2.5" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M5 19l1.5-4A7.5 7.5 0 1 1 9 18.5L5 19Z" />
          <path d="M9 11c.4 1.2 1.6 2.4 2.8 2.8M14 9.5c.5.3.9.8 1.1 1.4" />
        </svg>
      );
    case "staff":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20c1-3.5 3.5-5.5 7-5.5s6 2 7 5.5" />
          <path d="M16 4.5l1.5 1.5L20 3.5" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    default:
      return null;
  }
}

function HeroDoodles() {
  return (
    <div className="landing-doodles pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <svg className="landing-doodle landing-doodle-pulse absolute left-[6%] top-[20%] h-14 w-24 text-[#1a5c5c]/40 sm:left-[10%] sm:top-[26%] sm:h-16 sm:w-28" viewBox="0 0 120 40" fill="none">
        <path
          d="M2 22h18l6-14 10 28 8-18 6 8h52"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg className="landing-doodle landing-doodle-float absolute right-[8%] top-[16%] h-12 w-12 text-[#c45c4a]/50 sm:right-[12%] sm:top-[20%] sm:h-14 sm:w-14" viewBox="0 0 48 48" fill="none">
        <path
          d="M24 42s-14-9.2-14-20a8 8 0 0 1 14-5.2A8 8 0 0 1 38 22c0 10.8-14 20-14 20Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M24 16v12M18 22h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="landing-doodle landing-doodle-float-slow absolute bottom-[16%] left-[5%] h-16 w-12 text-[#1a5c5c]/45 sm:bottom-[20%] sm:left-[8%] sm:h-20 sm:w-14" viewBox="0 0 40 56" fill="none">
        <rect x="4" y="2" width="32" height="48" rx="4" stroke="currentColor" strokeWidth="2" />
        <rect x="8" y="8" width="24" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
        <circle cx="20" cy="48" r="1.8" fill="currentColor" />
        <path d="M12 16h16M12 22h12M12 28h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <svg className="landing-doodle landing-doodle-float absolute right-[5%] top-[42%] h-14 w-14 text-[#1a5c5c]/40 sm:right-[7%] sm:h-16 sm:w-16" viewBox="0 0 56 56" fill="none">
        <path d="M16 8v10a12 12 0 0 0 24 0V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 8c0-2 2-4 4-4h2M40 8c0-2-2-4-4-4h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 30v8a8 8 0 1 0 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="40" cy="38" r="5" stroke="currentColor" strokeWidth="2" />
      </svg>
      <svg className="landing-doodle landing-doodle-float-slow absolute left-[42%] top-[14%] hidden h-12 w-12 text-[#1a5c5c]/35 sm:block" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="10" width="36" height="30" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M6 18h36M16 6v8M32 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="18" cy="28" r="2" fill="currentColor" />
        <circle cx="30" cy="28" r="2" fill="currentColor" />
      </svg>
      <svg className="landing-doodle landing-doodle-float absolute bottom-[28%] right-[28%] hidden h-11 w-12 text-[#c45c4a]/40 lg:block" viewBox="0 0 48 44" fill="none">
        <path
          d="M8 6h32a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H22l-10 8v-8H8a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M14 18h20M14 24h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="landing-doodle landing-doodle-float-slow absolute bottom-[12%] right-[14%] h-14 w-8 text-[#1a5c5c]/40 sm:bottom-[14%] sm:right-[18%]" viewBox="0 0 28 56" fill="none">
        <path d="M14 6v28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="10" y="4" width="8" height="30" rx="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="14" cy="42" r="8" stroke="currentColor" strokeWidth="2" />
        <circle cx="14" cy="42" r="3.5" fill="currentColor" />
      </svg>
      <svg className="landing-doodle landing-doodle-float absolute left-[18%] top-[48%] hidden h-12 w-12 text-[#1a5c5c]/35 md:block" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
        <path d="M24 14v10l6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="landing-doodle landing-doodle-float-slow absolute right-[36%] bottom-[14%] hidden h-10 w-14 text-[#c45c4a]/35 lg:block" viewBox="0 0 56 40" fill="none">
        <rect x="4" y="8" width="48" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M4 16h48M14 8V4M42 8V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 26h8M28 26h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="landing-doodle absolute left-[28%] bottom-[20%] h-10 w-16 text-[#1a5c5c]/30" viewBox="0 0 80 40" fill="none">
        <path d="M12 20l2.2-6 2.2 6 6 2.2-6 2.2-2.2 6-2.2-6-6-2.2 6-2.2Z" fill="currentColor" />
        <path d="M48 12l1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="currentColor" />
        <circle cx="68" cy="24" r="2" fill="currentColor" />
      </svg>
      <svg className="landing-doodle absolute right-[22%] top-[32%] h-8 w-14 text-[#c45c4a]/25" viewBox="0 0 80 40" fill="none">
        <path d="M8 28c8-16 16-16 24 0s16 16 24 0 16-16 24 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="landing-doodle landing-doodle-float absolute left-[52%] top-[58%] hidden h-11 w-11 text-[#1a5c5c]/30 xl:block" viewBox="0 0 44 44" fill="none">
        <path d="M8 14h28v18H8z" stroke="currentColor" strokeWidth="2" />
        <path d="M14 14V10a8 8 0 0 1 16 0v4" stroke="currentColor" strokeWidth="2" />
        <circle cx="22" cy="23" r="3" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}

function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? 56 : size === "sm" ? 32 : 40;
  const text =
    size === "lg"
      ? "text-4xl sm:text-5xl lg:text-6xl"
      : size === "sm"
        ? "text-xl sm:text-2xl"
        : "text-2xl sm:text-3xl";

  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/mederp-icon.png"
        alt=""
        width={dims}
        height={dims}
        className="rounded-md shadow-sm"
        priority={size === "lg"}
      />
      <span className={`landing-brand font-semibold tracking-tight text-[#0c2f2c] ${text}`}>MedERP</span>
    </span>
  );
}

/** Swap these when App Store / Play Store listings are live. */
const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

const storeBadgeClass =
  "inline-flex h-12 items-center gap-3 rounded-xl border px-4 text-white shadow-[0_8px_20px_rgb(0_0_0_/_0.2)] transition";

function AppStoreBadge({ href = APP_STORE_URL }: { href?: string }) {
  return (
    <a
      href={href}
      className={`${storeBadgeClass} border-[#5b9dff]/40 bg-gradient-to-br from-[#1a2744] to-[#0b1220] hover:from-[#243456] hover:to-[#121a2e]`}
      aria-label="Download on the App Store"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-[#8ec5ff]" fill="currentColor" aria-hidden>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-medium text-white/85">Download on the</span>
        <span className="mt-0.5 text-[15px] font-semibold tracking-tight text-white">App Store</span>
      </span>
    </a>
  );
}

function PlayStoreBadge({ href = PLAY_STORE_URL }: { href?: string }) {
  return (
    <a
      href={href}
      className={`${storeBadgeClass} border-[#34a853]/35 bg-gradient-to-br from-[#1a2e24] to-[#0b1410] hover:from-[#243d30] hover:to-[#121c16]`}
      aria-label="Get it on Google Play"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 drop-shadow-sm" aria-hidden>
        <path fill="#EA4335" d="M3.2 2.4c-.5.3-.8.8-.8 1.4v16.4c0 .6.3 1.1.8 1.4L14.5 12 3.2 2.4Z" />
        <path fill="#FBBC04" d="m16.8 10.4-3.4 2.5 3.4 2.7 3.4-1.9c.7-.4.7-1.4 0-1.8l-3.4-1.5Z" />
        <path fill="#4285F4" d="M16.8 15.6 3.9 21.8c.3.3.7.4 1.1.2l14.3-8.2-2.5 1.8Z" />
        <path fill="#34A853" d="M16.8 8.4 19.3 7c.4-.2.8-.1 1.1.2L3.9 2.2c.3-.2.7-.2 1.1.1l11.8 6.1Z" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-medium text-white/85">Get it on</span>
        <span className="mt-0.5 text-[15px] font-semibold tracking-tight text-white">Google Play</span>
      </span>
    </a>
  );
}

function AppDownloadBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <AppStoreBadge />
      <PlayStoreBadge />
    </div>
  );
}

export function MarketingLanding() {
  return (
    <div className={`landing min-h-dvh text-[#0c1f2e] ${display.variable} ${body.variable}`}>
      <header className="landing-nav absolute inset-x-0 top-0 z-20 flex items-center px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="inline-flex items-center">
          <BrandMark size="sm" />
        </Link>
      </header>

      <section className="landing-hero relative flex min-h-dvh items-end overflow-hidden px-5 pb-16 pt-28 sm:items-center sm:px-8 sm:pb-20 lg:px-12">
        <div className="landing-hero-bg absolute inset-0" aria-hidden />
        <div className="landing-hero-mesh absolute inset-0" aria-hidden />
        <HeroDoodles />
        <div className="relative z-10 max-w-2xl">
            <div className="landing-fade landing-delay-1">
              <BrandMark size="lg" />
            </div>
            <h1 className="landing-fade landing-delay-2 mt-5 max-w-xl text-2xl font-medium leading-snug text-[#0c2f2c] sm:text-3xl lg:text-[2.15rem]">
              Clinic ERP for OPD, nursing, billing, and day-to-day clinic operations.
            </h1>
            <p className="landing-fade landing-delay-3 mt-4 max-w-lg text-base leading-relaxed text-[#1f4a46]/85 sm:text-lg">
              Built for Indian clinics and polyclinics — reception, nurses, and doctors on one record, on web and mobile.
            </p>
            <div className="landing-fade landing-delay-4 mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className="landing-cta inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold">
                Book a demo
              </Link>
              <Link
                href="/register-hospital"
                className="landing-ghost inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
              >
                Register clinic
              </Link>
              <Link
                href="/login"
                className="landing-link-btn inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
              >
                Sign in
              </Link>
            </div>
            <div className="landing-fade landing-delay-4 mt-5">
              <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#1f4a46]/65">
                Mobile app
              </p>
              <AppDownloadBadges />
            </div>
        </div>
      </section>

      <section id="features" className="landing-section px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="landing-brand text-2xl font-semibold tracking-tight text-[#0c1f2e] sm:text-3xl">
            Everything your clinic needs
          </h2>
          <p className="mt-3 max-w-2xl text-base text-[#3d5668]">
            OPD, nurse vitals, doctor consult, billing, certificates, WhatsApp, and staff tools — in one clinic ERP.
          </p>
          <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="flex gap-3">
                <span className="landing-feature-icon mt-0.5">
                  <FeatureIconSvg name={feature.icon} />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[#0c1f2e]">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#3d5668]">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#d5e2ea] bg-white px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="landing-brand text-xl font-semibold text-[#0c1f2e] sm:text-2xl">See MedERP in your clinic</h2>
            <p className="mt-2 text-sm text-[#3d5668]">
              Book a walkthrough, or register and start a trial with your team.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="landing-cta inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
            >
              Book a demo
            </Link>
            <Link
              href="/register-hospital"
              className="landing-ghost inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
            >
              Register clinic
            </Link>
            <Link
              href="/login"
              className="landing-link-btn inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#c5e0da] bg-[#eaf6f3] px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Image src="/mederp-icon.png" alt="" width={36} height={36} className="h-9 w-9 rounded-md" />
            <div>
              <p className="landing-brand font-semibold text-[#0c1f2e]">MedERP</p>
              <p className="text-xs text-[#5a7385]">Clinic ERP for web and mobile</p>
            </div>
          </div>
          <AppDownloadBadges />
        </div>
        <div className="mx-auto mt-8 flex max-w-5xl flex-wrap gap-4 text-sm text-[#3d5668]">
          <Link href="/#features" className="hover:text-[#0c1f2e]">
            Features
          </Link>
          <Link href="/login" className="hover:text-[#0c1f2e]">
            Sign in
          </Link>
          <Link href="/register-hospital" className="hover:text-[#0c1f2e]">
            Register
          </Link>
          <Link href="/signup" className="hover:text-[#0c1f2e]">
            Staff signup
          </Link>
          <Link href="/help" className="hover:text-[#0c1f2e]">
            Help
          </Link>
          <Link href="/terms" className="hover:text-[#0c1f2e]">
            Terms
          </Link>
        </div>
        <div className="mx-auto mt-8 max-w-5xl">
          <DeveloperCredit />
          <div className="mt-3 text-center">
            <ManagedByCredit />
          </div>
        </div>
      </footer>
    </div>
  );
}
