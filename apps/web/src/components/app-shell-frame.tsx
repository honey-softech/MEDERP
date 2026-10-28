"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { RealtimeProvider } from "@/components/realtime-provider";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import type { ViewMode } from "@/lib/view-mode";

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

/** Pulses inside the clicked nav link until the next page is ready. */
function NavPulse() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`nav-pulse ml-auto ${pending ? "is-pending" : ""}`} />;
}

type NavIconKind =
  | "account"
  | "home"
  | "plus"
  | "settings"
  | "team"
  | "share"
  | "demo"
  | "users"
  | "hospital"
  | "audit"
  | "replies"
  | "inbox"
  | "card"
  | "tag"
  | "book"
  | "rx"
  | "package"
  | "chart"
  | "wallet"
  | "flask"
  | "certificate"
  | "pulse"
  | "queue"
  | "patients"
  | "calendar"
  | "badge"
  | "bed"
  | "pill"
  | "receipt"
  | "leave"
  | "clock"
  | "headset";

function navIconKind(href: string): NavIconKind {
  if (href === "/account") return "account";
  if (href === "/") return "home";
  if (href.startsWith("/platform/hospitals/new")) return "plus";
  if (href.startsWith("/platform/billing-settings") || href.startsWith("/hospital/settings")) return "settings";
  if (href.startsWith("/platform/helpdesk-team")) return "team";
  if (href.startsWith("/platform/referrals")) return "share";
  if (href.startsWith("/platform/demos")) return "demo";
  if (href.startsWith("/platform/users") || href.startsWith("/hospital/users")) return "users";
  if (href.startsWith("/platform/hospitals") || href === "/join" || href.startsWith("/join")) return "hospital";
  if (href.includes("audit-log")) return "audit";
  if (href.startsWith("/helpdesk/canned-replies")) return "replies";
  if (href.includes("join-requests")) return "inbox";
  if (href.startsWith("/hospital/subscription")) return "card";
  if (href.startsWith("/hospital/lab-prices") || href.startsWith("/drug-brands")) return "tag";
  if (href.startsWith("/medicine-catalog")) return "book";
  if (href.startsWith("/pharmacy/prescriptions")) return "rx";
  if (href.startsWith("/pharmacy/stock-in")) return "package";
  if (href.startsWith("/billing/reports")) return "chart";
  if (href.startsWith("/billing/collections")) return "wallet";
  if (href.startsWith("/billing/lab") || href.startsWith("/lab")) return "flask";
  if (href.startsWith("/certificates")) return "certificate";
  if (href.startsWith("/nurse")) return "pulse";
  if (href.startsWith("/queue")) return "queue";
  if (href.startsWith("/patients")) return "patients";
  if (href.startsWith("/appointments")) return "calendar";
  if (href.startsWith("/staff")) return "badge";
  if (href.startsWith("/wards")) return "bed";
  if (href.startsWith("/pharmacy")) return "pill";
  if (href.startsWith("/billing")) return "receipt";
  if (href.startsWith("/timesheet") || href.startsWith("/hospital/timesheets")) return "clock";
  if (href.startsWith("/leave") || href.startsWith("/hospital/leaves")) return "leave";
  return "headset";
}

function NavGlyph({ href }: { href: string }) {
  const className = "h-[1.05rem] w-[1.05rem] shrink-0";
  const stroke = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<NavIconKind, ReactNode> = {
    home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />,
    account: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 19.5c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5" />
      </>
    ),
    patients: (
      <>
        <circle cx="9" cy="8" r="2.6" />
        <path d="M3.8 19c.7-2.8 2.4-4.4 5.2-4.4s4.5 1.6 5.2 4.4" />
        <circle cx="17" cy="9" r="2" />
        <path d="M16 14.4c1.6.4 2.8 1.6 3.4 4.1" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="9" r="2.4" />
        <circle cx="16" cy="9" r="2.4" />
        <path d="M4.5 18.5c.6-2.4 2.2-3.8 4.5-3.8s3.9 1.4 4.5 3.8" />
        <path d="M13.5 14.8c1.5.2 2.8 1.2 3.5 3.7" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16" />
      </>
    ),
    queue: (
      <>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </>
    ),
    pulse: <path d="M3 12h4l2.2-5 3.6 10L15 12h6" />,
    badge: (
      <>
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <circle cx="12" cy="9" r="2" />
        <path d="M9 15h6M9 18h4" />
      </>
    ),
    team: (
      <>
        <circle cx="8" cy="9" r="2.2" />
        <circle cx="16" cy="9" r="2.2" />
        <path d="M4 18c.5-2.2 2-3.5 4-3.5s3.5 1.3 4 3.5M12 18c.5-2.2 2-3.5 4-3.5s3.5 1.3 4 3.5" />
      </>
    ),
    bed: (
      <>
        <path d="M3 18V9M3 14h18v4M21 18V11" />
        <path d="M7 14v-2.5A1.5 1.5 0 0 1 8.5 10h3A1.5 1.5 0 0 1 13 11.5V14" />
      </>
    ),
    pill: (
      <>
        <rect x="7.5" y="3" width="9" height="18" rx="4.5" />
        <path d="M12 8v8M8.5 12h7" />
      </>
    ),
    rx: (
      <>
        <path d="M7 4h7.5a3.5 3.5 0 0 1 0 7H7z" />
        <path d="M7 4v16M12.5 13.5 18 19M18 13.5 12.5 19" />
      </>
    ),
    package: (
      <>
        <path d="M12 3 20 7.5v9L12 21 4 16.5v-9z" />
        <path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" />
      </>
    ),
    flask: <path d="M9 3h6M10 3v6L5.5 20h13L14 9V3" />,
    receipt: (
      <>
        <path d="M7 3h10v18l-2-1.4-2 1.4-2-1.4L9 21l-2-1.4L7 21z" />
        <path d="M10 8h4M10 12h4" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V10M10 19V5M16 19v-7" />
        <path d="M3 19h18" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M3 11h18" />
        <path d="M16 15h2" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    certificate: (
      <>
        <path d="M7 3h10v13H7z" />
        <path d="M9.5 7.5h5M9.5 10.5h5" />
        <path d="M12 16v5l2-1.2 2 1.2v-5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4.5l3 2" />
      </>
    ),
    leave: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16" />
        <path d="M9 15.5 11 17.5 15.5 13" />
      </>
    ),
    headset: (
      <>
        <path d="M4 13a8 8 0 0 1 16 0" />
        <path d="M4 13v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2zM20 13v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
      </>
    ),
    plus: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
    hospital: (
      <>
        <path d="M4 20V9l8-5 8 5v11" />
        <path d="M9 20v-6h6v6M12 9v4M10 11h4" />
      </>
    ),
    audit: (
      <>
        <path d="M8 4h8l3 3v13H8z" />
        <path d="M16 4v3h3M11 11h5M11 15h5" />
      </>
    ),
    replies: <path d="M5 6h14v9H8l-3 3z" />,
    inbox: (
      <>
        <path d="M3 13h5l2 3h4l2-3h5" />
        <path d="M5 6h14l2 7v7H3v-7z" />
      </>
    ),
    tag: (
      <>
        <path d="M4 12V5h7l9 9-7 7z" />
        <circle cx="8.5" cy="8.5" r="1" />
      </>
    ),
    book: (
      <>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z" />
        <path d="M5 4v16" />
      </>
    ),
    share: (
      <>
        <circle cx="6.5" cy="12" r="2.2" />
        <circle cx="17" cy="7" r="2.2" />
        <circle cx="17" cy="17" r="2.2" />
        <path d="M8.5 11.2 14.8 8.2M8.5 12.8l6.3 3" />
      </>
    ),
    demo: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M12 12v3l2 1" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      {paths[navIconKind(href)]}
    </svg>
  );
}

function navItemClass(active: boolean, collapsed: boolean) {
  return `group relative flex h-11 items-center rounded-xl text-sm font-medium transition-colors ${
    collapsed ? "gap-2.5 px-2 md:justify-center md:px-0" : "gap-2.5 px-2"
  } ${active ? "bg-primary-light text-primary-dark" : "text-text-secondary hover:bg-app-bg hover:text-text-primary"}`;
}

function iconWellClass(active: boolean) {
  return `flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
    active
      ? "bg-primary text-white"
      : "bg-app-bg text-text-secondary group-hover:bg-primary-light group-hover:text-primary"
  }`;
}

export function AppShellFrame({
  title,
  brand,
  hospitalLabel,
  userLabel,
  nav,
  children,
  dense = false,
  viewMode,
}: {
  title: string;
  brand: string;
  hospitalLabel?: string;
  userLabel?: string;
  nav: NavLink[] | NavSection[];
  children: React.ReactNode;
  dense?: boolean;
  viewMode?: ViewMode;
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
      <SessionKeepAlive />
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
          <div className={`shrink-0 border-b border-border ${collapsed ? "px-2 py-3" : "px-3 py-4"}`}>
            <div className={`flex items-center gap-2 ${collapsed ? "md:flex-col md:justify-center" : "justify-between"}`}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </span>
                <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{brand}</p>
                  <h1 className="truncate text-base font-semibold leading-tight text-text-primary">MedERP</h1>
                  {hospitalLabel ? <p className="truncate text-xs text-text-secondary">{hospitalLabel}</p> : null}
                </div>
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
                          className={navItemClass(active, collapsed)}
                        >
                          {active ? (
                            <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden />
                          ) : null}
                          <span className={iconWellClass(active)}>
                            <NavGlyph href={item.href} />
                          </span>
                          <span className={`min-w-0 truncate ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
                          <span className={collapsed ? "md:hidden" : ""}>
                            <NavPulse />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className={`shrink-0 border-t border-border ${collapsed ? "p-2" : "p-3"}`}>
            <Link
              href="/account"
              title="Account"
              onClick={() => setMobileOpen(false)}
              className={navItemClass(pathname === "/account" || pathname.startsWith("/account/"), collapsed)}
            >
              {pathname === "/account" || pathname.startsWith("/account/") ? (
                <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden />
              ) : null}
              <span className={iconWellClass(pathname === "/account" || pathname.startsWith("/account/"))}>
                <NavGlyph href="/account" />
              </span>
              <span className={`min-w-0 truncate ${collapsed ? "md:hidden" : ""}`}>Account</span>
              <span className={collapsed ? "md:hidden" : ""}>
                <NavPulse />
              </span>
            </Link>
          </div>
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
            {viewMode ? <ViewModeToggle mode={viewMode} /> : null}
            <NotificationBell />
            <LogoutButton />
          </header>
          <div className={`print:p-0 ${dense ? "px-3 py-2 sm:px-4 lg:px-5" : "px-4 py-4 sm:px-6 sm:py-6 lg:px-8"}`}>{children}</div>
        </main>
      </div>
    </RealtimeProvider>
  );
}
