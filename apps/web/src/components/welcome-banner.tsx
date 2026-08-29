"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}

function formatNow(date: Date) {
  return {
    time: date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    date: date.toLocaleDateString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
      weekday: "long",
    }),
  };
}

function DoctorIllustration() {
  return (
    <svg viewBox="0 0 280 260" className="h-[200px] w-[200px] sm:h-[240px] sm:w-[240px]" aria-hidden>
      <ellipse cx="175" cy="210" rx="70" ry="18" fill="#bfdbfe" opacity="0.7" />
      <circle cx="200" cy="70" r="48" fill="#dbeafe" />
      <path d="M210 40c18 8 28 28 22 48" stroke="#93c5fd" strokeWidth="3" fill="none" />
      <circle cx="148" cy="58" r="8" fill="#93c5fd" />
      <path d="M40 120c30-40 80-20 70 20-8 32-50 40-70 8z" fill="#bfdbfe" opacity="0.5" />
      <g transform="translate(78 28)">
        <ellipse cx="62" cy="42" rx="28" ry="32" fill="#f3d2b5" />
        <path d="M38 38c4-22 48-24 50 2 1 8-4 12-10 14" fill="#1f2937" />
        <rect x="42" y="48" width="38" height="6" rx="3" fill="#1e3a5f" opacity="0.85" />
        <circle cx="50" cy="51" r="5" fill="none" stroke="#1e3a5f" strokeWidth="2" />
        <circle cx="72" cy="51" r="5" fill="none" stroke="#1e3a5f" strokeWidth="2" />
        <path d="M55 51h12" stroke="#1e3a5f" strokeWidth="2" />
        <path d="M52 68c6 6 14 6 20 0" stroke="#c2410c" strokeWidth="1.5" fill="none" />
        <path d="M34 82c8 18 48 18 56 0v38c-6 28-50 28-56 0z" fill="#eff6ff" />
        <path d="M42 88h40v8H42z" fill="#2563eb" />
        <path d="M58 88v48" stroke="#bfdbfe" strokeWidth="2" />
        <circle cx="62" cy="118" r="10" fill="none" stroke="#64748b" strokeWidth="3" />
        <path d="M62 108v-8" stroke="#64748b" strokeWidth="3" />
        <path d="M22 100c-2 22 6 40 18 44" fill="#eff6ff" />
        <path d="M102 100c2 22-6 40-18 44" fill="#eff6ff" />
        <ellipse cx="28" cy="146" rx="10" ry="8" fill="#f3d2b5" />
        <ellipse cx="96" cy="146" rx="10" ry="8" fill="#f3d2b5" />
      </g>
      <g transform="translate(188 96)">
        <rect x="0" y="0" width="46" height="36" rx="12" fill="#dbeafe" />
        <path d="M12 22c6-10 16-10 22 0" stroke="#2563eb" strokeWidth="2" fill="none" />
        <circle cx="23" cy="14" r="4" fill="#2563eb" />
      </g>
    </svg>
  );
}

export function WelcomeBanner({
  displayName,
  tagline,
  locationTitle,
  locationSubtitle,
  className = "",
  compact = false,
}: {
  displayName: string;
  tagline: string;
  locationTitle: string;
  locationSubtitle: string;
  className?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { time, date } = formatNow(now);
  const greeting = greetingForHour(now.getHours());

  return (
    <section
      className={`relative overflow-hidden rounded-xl border border-primary-light bg-gradient-to-r from-surface via-primary-light/40 to-primary-light px-5 py-6 sm:px-8 sm:py-7 ${
        compact ? "" : "mb-6 sm:mb-8"
      } ${className}`}
    >
      <div className={`pointer-events-none absolute -right-6 top-0 hidden h-full w-[42%] ${compact ? "" : "md:block"}`}>
        <div className="absolute right-8 top-6 h-40 w-40 rounded-full bg-primary-light/60" />
        <div className="absolute bottom-6 right-24 h-24 w-24 rounded-full bg-primary/10" />
      </div>
      <div className="relative z-10 flex h-full flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className={compact ? "max-w-lg" : "max-w-xl"}>
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            {greeting}
            <span className="mt-1 block text-primary">
              {displayName}! <span aria-hidden>👋</span>
            </span>
          </h2>
          <p className="mt-3 max-w-md text-sm text-text-secondary sm:text-base">{tagline}</p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-8">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-primary">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v5l3 2" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-text-primary">{time}</p>
                <p className="text-sm text-text-secondary">{date}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-primary">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.2" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-text-primary">{locationTitle}</p>
                <p className="text-sm text-text-secondary">{locationSubtitle}</p>
              </div>
            </div>
          </div>
        </div>
        {compact ? null : (
          <div className="relative mx-auto lg:mx-0">
            <DoctorIllustration />
          </div>
        )}
      </div>
    </section>
  );
}
