import Image from "next/image";
import Link from "next/link";
import { Fraunces, Source_Sans_3 } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-landing-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-landing-body",
});

export function MarketingPublic({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`landing text-[#10211e] ${display.variable} ${body.variable}`}>
      <header className="landing-nav">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link href="/" className="inline-flex min-w-0 items-center gap-2.5">
            <Image src="/mederp-icon.png" alt="" width={32} height={32} className="rounded-md shadow-sm" />
            <span className="landing-brand text-xl font-semibold tracking-tight text-[#10211e] sm:text-2xl">MedERP</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#3e5550] md:flex" aria-label="Page">
            <Link href="/features" className="hover:text-[#10211e]">
              Features
            </Link>
            <Link href="/pricing" className="hover:text-[#10211e]">
              Pricing
            </Link>
            <Link href="/demo" className="hover:text-[#10211e]">
              Demo
            </Link>
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
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="landing-kicker">{kicker}</p>
        <h1 className="landing-brand mt-3 text-3xl font-semibold tracking-tight text-[#10211e] sm:text-5xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-[#3e5550] sm:text-lg">{lede}</p>
        <div className="mt-10">{children}</div>
      </main>
      <footer className="border-t border-[#10211e]/10 px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 text-sm text-[#3e5550]">
          <Link href="/" className="hover:text-[#10211e]">
            Home
          </Link>
          <Link href="/features" className="hover:text-[#10211e]">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-[#10211e]">
            Pricing
          </Link>
          <Link href="/demo" className="hover:text-[#10211e]">
            Book a demo
          </Link>
          <Link href="/register-hospital" className="hover:text-[#10211e]">
            Register
          </Link>
          <Link href="/help" className="hover:text-[#10211e]">
            Help
          </Link>
        </div>
      </footer>
    </div>
  );
}
