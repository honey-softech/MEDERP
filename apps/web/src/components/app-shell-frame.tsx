"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { RealtimeProvider } from "@/components/realtime-provider";

export type NavLink = { href: string; label: string };
export type NavSection = { title?: string; items: NavLink[] };

const NAV_SCROLL_KEY = "mederp_sidebar_scroll";
const NAV_COLLAPSED_KEY = "mederp_sidebar_collapsed";

function normalizeNav(nav: NavLink[] | NavSection[]): NavSection[] {
  if (nav.length === 0) return [];
  if ("items" in nav[0]) return nav as NavSection[];
  return [{ items: nav as NavLink[] }];
}

function linkActive(pathname: string, href: string, allHrefs: string[]) {
  if (href === "/") return pathname === "/";

  // Visit workspace (/appointments/:id…) is opened from OPD queue for doctors/nurses —
  // keep Queue highlighted instead of Appointments.
  const isVisitWorkspace =
    /^\/appointments\/[^/]+/.test(pathname) && !pathname.startsWith("/appointments/new");
  if (isVisitWorkspace && allHrefs.includes("/queue")) {
    if (href === "/queue") return true;
    if (href === "/appointments") return false;
  }

  const matches = allHrefs.filter(
    (candidate) => candidate !== "/" && (pathname === candidate || pathname.startsWith(`${candidate}/`)),
  );
  if (matches.length === 0) return false;
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b));
  return best === href;
}

function NavGlyph({ href }: { href: string }) {
  const className = "h-[1.15rem] w-[1.15rem] shrink-0";
  const stroke = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (href === "/") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (href.startsWith("/patients") || href.startsWith("/platform/users") || href.startsWith("/hospital/users")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <circle cx="9" cy="8" r="3" />
        <path d="M4 19c.6-3 2.6-5 5-5s4.4 2 5 5" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M16.2 14.2c1.8.4 3.2 1.8 3.8 4.8" />
      </svg>
    );
  }
  if (href.startsWith("/appointments")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    );
  }
  if (href.startsWith("/queue") || href.startsWith("/nurse")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M4 7h16M4 12h10M4 17h7" />
      </svg>
    );
  }
  if (href.startsWith("/staff") || href.startsWith("/platform/helpdesk-team")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c1-4 3.5-6 7-6s6 2 7 6" />
      </svg>
    );
  }
  if (href.startsWith("/wards")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M4 20V8l8-4 8 4v12" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }
  if (href.startsWith("/pharmacy") || href.startsWith("/hospital/drug-brands") || href.startsWith("/drug-brands")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <rect x="7" y="3" width="10" height="18" rx="5" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  }
  if (href.startsWith("/lab") || href.startsWith("/hospital/lab-prices") || href.startsWith("/billing/lab")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M9 3h6M10 3v6L5 20h14L14 9V3" />
      </svg>
    );
  }
  if (href.startsWith("/billing") || href.startsWith("/platform/billing-settings") || href.startsWith("/hospital/subscription")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </svg>
    );
  }
  if (href.startsWith("/leave") || href.startsWith("/hospital/leaves")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M4 12a8 8 0 1 0 8-8" />
        <path d="M12 8v4l3 2M4 4v6h6" />
      </svg>
    );
  }
  if (href.startsWith("/helpdesk")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M5 11a7 7 0 1 1 14 0v4a2 2 0 0 1-2 2h-1v-6" />
        <path d="M8 17v1a4 4 0 0 0 8 0" />
      </svg>
    );
  }
  if (href.startsWith("/hospital/settings")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a7.7 7.7 0 0 0 .1-6l2-1.2-2-3.4-2.3.6a7.8 7.8 0 0 0-5.2-2L11 1H9l-.9 2.1a7.8 7.8 0 0 0-5.3 2L1.5 4.4l-2 3.5 2 1.1a7.7 7.7 0 0 0 0 6l-2 1.2 2 3.4 2.3-.6a7.8 7.8 0 0 0 5.2 2L9 23h2l.9-2.1a7.8 7.8 0 0 0 5.3-2l2.3.6 2-3.4z" />
      </svg>
    );
  }
  if (href.startsWith("/platform/hospitals/new")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (href.startsWith("/platform/hospitals") || href.startsWith("/join") || href.includes("join-requests")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M3 21V8l9-5 9 5v13" />
        <path d="M9 21v-8h6v8" />
      </svg>
    );
  }
  if (href.includes("audit-log")) {
    return (
      <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
        <path d="M7 4h10v16H7z" />
        <path d="M10 8h4M10 12h4M10 16h2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export function AppShellFrame({
  title,
  brand,
  hospitalLabel,
  userLabel,
  nav,
  children,
  dense = false,
}: {
  title: string;
  brand: string;
  hospitalLabel?: string;
  userLabel?: string;
  nav: NavLink[] | NavSection[];
  children: React.ReactNode;
  dense?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const sections = normalizeNav(nav);
  const allHrefs = sections.flatMap((section) => section.items.map((item) => item.href));
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    try {
      setCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
    const el = navRef.current;
    if (!el) return;
    try {
      const saved = sessionStorage.getItem(NAV_SCROLL_KEY);
      if (saved != null) el.scrollTop = Number(saved) || 0;
    } catch {
      /* ignore */
    }
  }, [pathname]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    function onScroll() {
      try {
        sessionStorage.setItem(NAV_SCROLL_KEY, String(el!.scrollTop));
      } catch {
        /* ignore */
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function persistNavScroll() {
    const el = navRef.current;
    if (!el) return;
    try {
      sessionStorage.setItem(NAV_SCROLL_KEY, String(el.scrollTop));
    } catch {
      /* ignore */
    }
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <RealtimeProvider>
      <div className="min-h-dvh bg-app-bg text-text-primary print:bg-white">
        {mobileOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-text-primary/40 print:hidden md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-surface transition-[transform,width] duration-200 print:hidden ${
            collapsed ? "md:w-[4.25rem]" : "md:w-[16.5rem]"
          } w-[min(16.5rem,85vw)] ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        >
          <div className={`shrink-0 border-b border-border ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}>
            <div className={`flex items-start gap-2 ${collapsed ? "md:justify-center" : "justify-between"}`}>
              <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{brand}</p>
                <h1 className="mt-1 text-lg font-semibold text-text-primary">MedERP</h1>
                {hospitalLabel ? (
                  <p className="mt-1 truncate text-xs text-text-secondary">{hospitalLabel}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-app-bg hover:text-text-primary md:inline-flex"
                aria-label={collapsed ? "Expand menu" : "Collapse menu"}
                title={collapsed ? "Expand menu" : "Collapse menu"}
                onClick={toggleCollapsed}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            </div>
          </div>

          <nav ref={navRef} className={`flex-1 space-y-5 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
            {sections.map((section, index) => (
              <div key={section.title ?? `section-${index}`}>
                {section.title ? (
                  <p
                    className={`mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-disabled ${
                      collapsed ? "md:hidden" : ""
                    }`}
                  >
                    {section.title}
                  </p>
                ) : null}
                {section.title && collapsed ? <div className="mx-2 mb-1 hidden border-t border-border md:block" /> : null}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = linkActive(pathname, item.href, allHrefs);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={item.label}
                          onClick={() => {
                            persistNavScroll();
                            setMobileOpen(false);
                          }}
                          className={`flex h-10 items-center rounded-lg text-sm font-medium transition-colors ${
                            collapsed ? "justify-center px-0 md:px-0" : "gap-2.5 px-3"
                          } ${
                            active
                              ? "bg-primary-light text-primary-dark"
                              : "text-text-secondary hover:bg-app-bg hover:text-text-primary"
                          }`}
                        >
                          <span className="hidden md:inline-flex">
                            <NavGlyph href={item.href} />
                          </span>
                          <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className={`min-h-dvh overflow-x-hidden print:ml-0 ${collapsed ? "md:ml-[4.25rem]" : "md:ml-[16.5rem]"}`}>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur print:hidden sm:gap-3 sm:px-6 lg:px-8">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-primary md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <span className="sr-only">Menu</span>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2>
              {userLabel ? <p className="truncate text-xs text-text-secondary">{userLabel}</p> : null}
            </div>
            <NotificationBell />
            <LogoutButton />
          </header>
          <div className={`print:p-0 ${dense ? "px-3 py-2 sm:px-4 lg:px-5" : "px-4 py-4 sm:px-6 sm:py-6 lg:px-8"}`}>{children}</div>
        </main>
      </div>
    </RealtimeProvider>
  );
}
