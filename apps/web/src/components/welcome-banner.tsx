"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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
      className={`home-hero relative flex overflow-hidden rounded-3xl text-white ${
        compact ? "h-full min-h-[16rem] px-5 py-5 sm:px-6" : "mb-5 px-6 py-7 sm:mb-6 sm:px-8 sm:py-8"
      } ${className}`}
    >
      <div className="home-hero-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className={`relative z-10 flex h-full w-full flex-col ${compact ? "justify-between gap-6" : ""}`}>
        <div className={compact ? "max-w-lg" : "max-w-2xl"}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b9d4f5]">{date}</p>
          <h2
            className={`mt-3 font-semibold tracking-[-0.03em] text-white ${
              compact ? "text-[1.65rem] leading-tight sm:text-3xl" : "text-4xl leading-[1.05] sm:text-5xl"
            }`}
          >
            <span className="block font-medium text-white/75">{greeting}</span>
            <span className="mt-1 block">{displayName}</span>
          </h2>
          <p className={`max-w-md text-white/70 ${compact ? "mt-2 text-sm" : "mt-4 text-base"}`}>{tagline}</p>
        </div>
        <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-8"}`}>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white">
            <span className="home-live-dot" aria-hidden />
            {time}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white">{locationTitle}</span>
          <span className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80">{locationSubtitle}</span>
        </div>
      </div>
    </section>
  );
}
