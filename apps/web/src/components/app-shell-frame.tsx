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

function normalizeNav(nav: NavLink[] | NavSection[]): NavSection[] {
  if (nav.length === 0) return [];
  if ("items" in nav[0]) return nav as NavSection[];
  return [{ items: nav as NavLink[] }];
}

function linkActive(pathname: string, href: string, allHrefs: string[]) {
  if (href === "/") return pathname === "/";
  const matches = allHrefs.filter(
    (candidate) => candidate !== "/" && (pathname === candidate || pathname.startsWith(`${candidate}/`)),
  );
  if (matches.length === 0) return false;
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b));
  return best === href;
}

export function AppShellFrame({
  title,
  brand,
  hospitalLabel,
  userLabel,
  nav,
  children,
}: {
  title: string;
  brand: string;
  hospitalLabel?: string;
  userLabel?: string;
  nav: NavLink[] | NavSection[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sections = normalizeNav(nav);
  const allHrefs = sections.flatMap((section) => section.items.map((item) => item.href));
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
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

  return (
    <RealtimeProvider>
      <div className="min-h-dvh bg-app-bg text-text-primary print:bg-white">
        {open ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-text-primary/40 print:hidden md:hidden"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[min(16.5rem,85vw)] flex-col border-r border-border bg-surface transition-transform duration-200 print:hidden md:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="shrink-0 border-b border-border px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{brand}</p>
            <h1 className="mt-1 text-lg font-semibold text-text-primary">MedERP</h1>
            {hospitalLabel ? (
              <p className="mt-1 truncate text-xs text-text-secondary">{hospitalLabel}</p>
            ) : null}
          </div>

          <nav ref={navRef} className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {sections.map((section, index) => (
              <div key={section.title ?? `section-${index}`}>
                {section.title ? (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-disabled">
                    {section.title}
                  </p>
                ) : null}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = linkActive(pathname, item.href, allHrefs);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => {
                            const el = navRef.current;
                            if (el) {
                              try {
                                sessionStorage.setItem(NAV_SCROLL_KEY, String(el.scrollTop));
                              } catch {
                                /* ignore */
                              }
                            }
                            setOpen(false);
                          }}
                          className={`flex h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                            active
                              ? "bg-primary-light text-primary-dark"
                              : "text-text-secondary hover:bg-app-bg hover:text-text-primary"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-h-dvh print:ml-0 md:ml-[16.5rem]">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur print:hidden sm:gap-3 sm:px-6 lg:px-8">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-primary md:hidden"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
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
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 print:p-0">{children}</div>
        </main>
      </div>
    </RealtimeProvider>
  );
}
