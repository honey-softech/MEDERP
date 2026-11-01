"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function WelcomeBanner({
  displayName,
  locationTitle,
  locationSubtitle,
  actions = [],
  className = "",
}: {
  displayName: string;
  locationTitle: string;
  locationSubtitle: string;
  actions?: { href: string; label: string; primary?: boolean }[];
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const greeting = greetingForHour(now.getHours());

  return (
    <section className={`home-greeting relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-3xl px-4 py-4 text-white sm:px-5 ${className}`}>
      <div className="home-greeting-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative min-w-0">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">
          <span className="font-medium text-white/75">{greeting}, </span>
          {displayName}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/75">
          <span className="inline-flex items-center gap-1.5">
            <span className="home-live-dot" aria-hidden />
            {time}
          </span>
          <span aria-hidden>·</span>
          <span>{locationTitle}</span>
          <span aria-hidden>·</span>
          <span>{locationSubtitle}</span>
        </p>
      </div>
      {actions.length > 0 ? (
        <div className="relative flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={
                action.primary
                  ? "inline-flex h-9 items-center justify-center rounded-lg bg-white px-3 text-sm font-medium text-[#0b1c33] hover:bg-white/90"
                  : "inline-flex h-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/15"
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
