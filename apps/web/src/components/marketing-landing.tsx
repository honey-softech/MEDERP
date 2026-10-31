import Image from "next/image";
import Link from "next/link";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { DeveloperCredit, ManagedByCredit } from "@/components/auth-branding";
import { OpenOnWeb } from "@/components/open-on-web";
import { MEDERP_PUBLIC_ORIGIN, mederpWebUrl } from "@/lib/mobile-app";

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

const daySteps = [
  {
    n: "01",
    title: "Front desk",
    body: "Register the patient, book the slot, and issue the token. Walk-ins and appointments share one queue.",
  },
  {
    n: "02",
    title: "Nurse station",
    body: "Vitals are recorded before the consult starts, so the doctor opens a visit that is already prepared.",
  },
  {
    n: "03",
    title: "Doctor consult",
    body: "Assessment, diagnosis, prescription, investigations, and a printable visit summary on the same chart.",
  },
  {
    n: "04",
    title: "Close the visit",
    body: "Bill, collect, issue a certificate, and send the summary on WhatsApp before the patient leaves.",
  },
];

function ClinicStage() {
  const rows = [
    { token: "T-014", name: "Meera S.", meta: "With doctor", tone: "live" },
    { token: "T-015", name: "Arjun P.", meta: "Vitals in", tone: "ready" },
    { token: "T-016", name: "Fatima K.", meta: "Waiting", tone: "wait" },
    { token: "T-017", name: "Rohan D.", meta: "Just arrived", tone: "wait" },
  ] as const;

  return (
    <div className="landing-stage" aria-hidden>
      <div className="landing-stage-glow" />
      <div className="landing-board">
        <div className="flex items-center justify-between gap-3 border-b border-[#10211e]/8 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="landing-live-dot" />
            <p className="text-[13px] font-semibold tracking-tight text-[#10211e]">Today&apos;s OPD</p>
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#5c726c]">Sample day</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <p className="landing-brand text-xl font-semibold tracking-tight text-[#10211e]">Dr. Mehta</p>
            <p className="mt-0.5 text-xs text-[#5c726c]">General medicine · Room 2</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#e7f5f2] px-2.5 py-1 text-[11px] font-semibold text-[#0c5c54]">Waiting 6</span>
            <span className="rounded-full bg-[#10211e] px-2.5 py-1 text-[11px] font-semibold text-[#f6f3ec]">In consult 1</span>
          </div>
        </div>
        <ul className="space-y-1.5 px-3 pb-3 sm:px-4 sm:pb-4">
          {rows.map((row) => (
            <li
              key={row.token}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                row.tone === "live" ? "bg-[#10211e] text-[#f6f3ec]" : "bg-[#f7f5f0] text-[#10211e]"
              }`}
            >
              <span className={`w-12 font-mono text-xs font-semibold ${row.tone === "live" ? "text-[#9ddecf]" : "text-[#0c5c54]"}`}>
                {row.token}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
              <span className={`text-[11px] font-medium ${row.tone === "live" ? "text-[#d7ebe4]" : "text-[#5c726c]"}`}>
                {row.meta}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="landing-floaters">
        <div className="landing-floater landing-floater-bill">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5c726c]">Collections</p>
          <p className="landing-brand mt-1 text-lg font-semibold text-[#10211e]">₹12,480</p>
          <p className="text-[11px] text-[#5c726c]">4 receipts · today</p>
        </div>
        <div className="landing-floater landing-floater-note">
          <span className="landing-live-dot landing-live-dot-coral" />
          <p className="text-sm font-medium text-[#10211e]">Visit summary sent on WhatsApp</p>
        </div>
      </div>
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
      <span className={`landing-brand font-semibold tracking-tight text-[#10211e] ${text}`}>MedERP</span>
    </span>
  );
}

const storeBadgeClass =
  "inline-flex h-12 cursor-default items-center gap-3 rounded-xl border px-4 text-white shadow-[0_8px_20px_rgb(0_0_0_/_0.2)]";

function AppStoreBadge() {
  return (
    <div
      className={`${storeBadgeClass} border-[#5b9dff]/40 bg-gradient-to-br from-[#1a2744] to-[#0b1220]`}
      aria-label="iOS app is under construction and coming soon on the App Store"
      role="note"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-[#8ec5ff]" fill="currentColor" aria-hidden>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f3c96b]">Coming soon</span>
        <span className="mt-0.5 text-[15px] font-semibold tracking-tight text-white">App Store</span>
      </span>
    </div>
  );
}

function PlayStoreBadge() {
  return (
    <div
      className={`${storeBadgeClass} border-[#34a853]/35 bg-gradient-to-br from-[#1a2e24] to-[#0b1410]`}
      aria-label="Android app is under construction and coming soon on Google Play"
      role="note"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 drop-shadow-sm" aria-hidden>
        <path fill="#EA4335" d="M3.2 2.4c-.5.3-.8.8-.8 1.4v16.4c0 .6.3 1.1.8 1.4L14.5 12 3.2 2.4Z" />
        <path fill="#FBBC04" d="m16.8 10.4-3.4 2.5 3.4 2.7 3.4-1.9c.7-.4.7-1.4 0-1.8l-3.4-1.5Z" />
        <path fill="#4285F4" d="M16.8 15.6 3.9 21.8c.3.3.7.4 1.1.2l14.3-8.2-2.5 1.8Z" />
        <path fill="#34A853" d="M16.8 8.4 19.3 7c.4-.2.8-.1 1.1.2L3.9 2.2c.3-.2.7-.2 1.1.1l11.8 6.1Z" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f3c96b]">Coming soon</span>
        <span className="mt-0.5 text-[15px] font-semibold tracking-tight text-white">Google Play</span>
      </span>
    </div>
  );
}

function AppDownloadBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a6a2f]">Under construction</p>
      <div className="flex flex-wrap items-center gap-3">
        <AppStoreBadge />
        <PlayStoreBadge />
      </div>
    </div>
  );
}

const faqs = [
  {
    question: "What is MedERP?",
    answer:
      "MedERP is clinic and hospital ERP for India. It is OPD management software for the queue, nurse vitals, doctor consult, billing, pharmacy, lab, and WhatsApp.",
  },
  {
    question: "Who is MedERP for?",
    answer:
      "Clinics and hospitals in India that want reception, nurses, and doctors working one patient record, on the web and in the staff app.",
  },
  {
    question: "Does MedERP send updates on WhatsApp?",
    answer: "Yes. Staff can send visit summaries, bills, and reminders on WhatsApp before the patient leaves.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "MedERP",
      url: MEDERP_PUBLIC_ORIGIN,
      logo: `${MEDERP_PUBLIC_ORIGIN}/mederp-icon.png`,
      description:
        "Clinic and hospital ERP for India: OPD management, billing, pharmacy, lab, and WhatsApp on the web and in the staff app.",
      areaServed: "IN",
      slogan: "Clinic and hospital ERP for India",
    },
    {
      "@type": "SoftwareApplication",
      name: "MedERP",
      url: MEDERP_PUBLIC_ORIGIN,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description:
        "OPD management software for Indian clinics and hospitals. Queue, nurse vitals, doctor consult, clinic billing, pharmacy, lab, and WhatsApp in one record.",
      offers: {
        "@type": "Offer",
        url: `${MEDERP_PUBLIC_ORIGIN}/register-hospital`,
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

export function MarketingLanding({ isMobileApp = false }: { isMobileApp?: boolean }) {
  return (
    <div className={`landing text-[#10211e] ${display.variable} ${body.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="landing-nav">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link href="/" className="inline-flex min-w-0 items-center">
            <BrandMark size="sm" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#3e5550] md:flex" aria-label="Page">
            <a href="#workflow" className="hover:text-[#10211e]">
              The day
            </a>
            <a href="#features" className="hover:text-[#10211e]">
              Features
            </a>
            <a href="#faq" className="hover:text-[#10211e]">
              FAQ
            </a>
            {isMobileApp ? null : (
              <a href="#mobile" className="hover:text-[#10211e]">
                Mobile
              </a>
            )}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <a href="/login" className="landing-quiet hidden h-10 items-center px-3 text-sm font-semibold sm:inline-flex">
              Sign in
            </a>
            <Link href="/demo" className="landing-cta inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold">
              Book a demo
            </Link>
          </div>
        </div>
      </header>

      <section className="relative px-5 pb-8 pt-6 sm:px-8 sm:pb-16 sm:pt-10 lg:pb-20 lg:pt-14">
        <div className="landing-hero-wash pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid min-w-0 max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
          <div className="landing-hero-copy min-w-0 max-w-xl">
            <p className="landing-kicker">Clinic ERP · India</p>
            <h1 className="landing-display mt-4 text-[#10211e]">
              From the first token
              <span className="landing-display-em"> to the last bill.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#3e5550] sm:text-lg">
              MedERP is clinic and hospital ERP for India: OPD management software for the queue, nurse vitals, doctor consult, billing, and WhatsApp. Reception, nurses, and doctors share one patient record on the web and in the staff app.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className="landing-cta inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
                Book a demo
              </Link>
              {isMobileApp ? null : (
                <Link
                  href="/register-hospital"
                  className="landing-ghost inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold"
                >
                  Register clinic
                </Link>
              )}
              <a href="/login" className="landing-link-btn inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold sm:hidden">
                Sign in
              </a>
            </div>
            {isMobileApp ? (
              <div className="mt-6 max-w-lg">
                <OpenOnWeb
                  message="Clinic registration is managed on the MedERP website from a web browser."
                  url={mederpWebUrl("/register-hospital")}
                />
              </div>
            ) : null}
            <dl className="mt-8 grid gap-3 border-t border-[#10211e]/10 pt-5 min-[480px]:grid-cols-3 min-[480px]:gap-x-3">
              {[
                ["One chart", "OPD through billing"],
                ["Every role", "Desk, nurse, doctor"],
                ["Two surfaces", "Web and staff app"],
              ].map(([label, detail]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[13px] font-semibold text-[#10211e] sm:text-sm">{label}</dt>
                  <dd className="mt-1 text-[11px] leading-snug text-[#5c726c] sm:text-xs">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <ClinicStage />
        </div>
      </section>

      <section id="workflow" className="landing-day px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="landing-kicker landing-kicker-light">How a clinic day runs</p>
              <h2 className="landing-brand mt-3 max-w-lg text-3xl font-semibold tracking-tight text-[#f6f3ec] sm:text-4xl">
                Four desks. One visit.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[#c9ddd6]">
              The token started at reception is the same visit the nurse, the doctor, and the bill all close.
            </p>
          </div>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-[1.75rem] bg-[#f6f3ec]/10 sm:grid-cols-2 lg:grid-cols-4">
            {daySteps.map((step) => (
              <li key={step.n} className="bg-[#0e1c19] px-5 py-6 sm:px-6 sm:py-7">
                <p className="landing-brand text-3xl font-medium text-[#7dcec0]">{step.n}</p>
                <h3 className="mt-6 text-lg font-semibold text-[#f6f3ec]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#c9ddd6]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="landing-kicker">What the clinic gets</p>
          <h2 className="landing-brand mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-[#10211e] sm:text-4xl">
            The work of the day, already laid out.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#3e5550]">
            OPD, nurse vitals, doctor consult, billing, certificates, WhatsApp, and staff tools — in one clinic ERP.
          </p>
          <div className="landing-bento mt-10">
            {features.map((feature, index) => (
              <article key={feature.title} className={`landing-card ${index === 0 ? "landing-card-lead" : ""}`}>
                <span className="landing-feature-icon">
                  <FeatureIconSvg name={feature.icon} />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-[#10211e]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3e5550]">{feature.body}</p>
                {index === 0 ? (
                  <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
                    {["T-001", "Walk-in", "Appointment", "Department"].map((chip) => (
                      <span key={chip} className="rounded-full border border-[#10211e]/10 bg-white/80 px-3 py-1 text-xs font-medium text-[#3e5550]">
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="landing-kicker">Questions</p>
          <h2 className="landing-brand mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-[#10211e] sm:text-4xl">
            Clinic ERP, answered.
          </h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {faqs.map((item) => (
              <article key={item.question} className="landing-card">
                <h3 className="text-lg font-semibold tracking-tight text-[#10211e]">{item.question}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#3e5550]">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {isMobileApp ? null : (
        <section id="mobile" className="px-4 pb-6 sm:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[1.75rem] bg-white px-6 py-8 shadow-[0_20px_50px_-32px_rgb(16_33_30_/_0.45)] sm:px-10 sm:py-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="landing-kicker">Staff app</p>
              <h2 className="landing-brand mt-3 text-3xl font-semibold tracking-tight text-[#10211e] sm:text-4xl">
                The same clinic, in a pocket.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#3e5550] sm:text-base">
                Doctors, nurses, and reception will use the MedERP app for the queue, vitals, and visit — the record stays the one on the web. The iOS and Android apps are under construction and coming soon.
              </p>
            </div>
            <AppDownloadBadges className="lg:items-end" />
          </div>
        </section>
      )}

      <section className="px-4 py-16 sm:px-8 sm:py-20">
        <div className="landing-close mx-auto max-w-6xl px-6 py-12 sm:px-12 sm:py-16">
          <p className="landing-kicker landing-kicker-light">Next step</p>
          <h2 className="landing-brand mt-3 max-w-xl text-3xl font-semibold tracking-tight text-[#f6f3ec] sm:text-5xl">
            See MedERP on your own OPD.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#c9ddd6] sm:text-base">
            {isMobileApp
              ? "Book a walkthrough with your team."
              : "Book a walkthrough, or register and start a trial with your team."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="landing-cta-light inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
              Book a demo
            </Link>
            {isMobileApp ? null : (
              <Link href="/register-hospital" className="landing-ghost-light inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
                Register clinic
              </Link>
            )}
            <a href="/login" className="landing-ghost-light inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold">
              Sign in
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#10211e]/10 px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Image src="/mederp-icon.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
            <div>
              <p className="landing-brand font-semibold text-[#10211e]">MedERP</p>
              <p className="text-xs text-[#5c726c]">Clinic ERP for web and mobile</p>
            </div>
          </div>
          {isMobileApp ? null : <AppDownloadBadges />}
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl flex-wrap gap-x-5 gap-y-2 text-sm text-[#3e5550]">
          <Link href="/#features" className="hover:text-[#10211e]">
            Features
          </Link>
          <a href="/login" className="hover:text-[#10211e]">
            Sign in
          </a>
          {isMobileApp ? null : (
            <Link href="/register-hospital" className="hover:text-[#10211e]">
              Register
            </Link>
          )}
          <Link href="/signup" className="hover:text-[#10211e]">
            Staff signup
          </Link>
          <Link href="/help" className="hover:text-[#10211e]">
            Help
          </Link>
          <Link href="/terms" className="hover:text-[#10211e]">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-[#10211e]">
            Privacy
          </Link>
        </div>
        <div className="landing-credits mx-auto mt-8 max-w-6xl">
          <DeveloperCredit />
          <div className="mt-3 text-center">
            <ManagedByCredit />
          </div>
        </div>
      </footer>
    </div>
  );
}
