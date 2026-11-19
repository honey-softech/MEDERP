"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  getPageTour,
  pageTourSeenKey,
  selectPageTourSteps,
  type PageTourSide,
  type PageTourStep,
} from "@/lib/page-tours";
import { getTourSteps, tourSelector, type TourStepDef } from "@/lib/tour-steps";

type PopoverNode = { description: HTMLElement };

export function ProductTourButton({
  role,
  hrefs,
  includeViewMode,
  collapsed,
  viewerId,
  onPrepare,
}: {
  role?: string;
  hrefs: string[];
  includeViewMode: boolean;
  collapsed: boolean;
  viewerId?: string;
  onPrepare: (mode: "page" | "menu") => void;
}) {
  const pathname = usePathname();
  const pageTour = getPageTour(role, pathname);
  const menuSteps = getTourSteps(role, hrefs, includeViewMode);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const driverRef = useRef<{ destroy: () => void } | null>(null);
  const chainMenu = useRef(false);
  const pageTourId = pageTour?.id ?? null;
  const seen = usePageTourSeen(viewerId, pageTourId);
  const nudgeOpen = Boolean(pageTourId && viewerId && !seen && !running);

  if (menuSteps.length === 0 && !pageTour) return null;

  function remember(tourId: string) {
    if (!viewerId) return;
    markPageTourSeen(viewerId, tourId);
  }

  function dismissNudge() {
    if (pageTour) remember(pageTour.id);
  }

  async function start(prefer: "page" | "menu") {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    if (pageTour) remember(pageTour.id);

    let mode: "page" | "menu" = prefer === "page" && pageTour ? "page" : "menu";
    onPrepare(mode);
    await wait(mode === "menu" ? 340 : 80);

    let pageSteps: PageTourStep[] = [];
    if (mode === "page" && pageTour) {
      pageSteps = selectPageTourSteps(pageTour.steps, (anchor) => Boolean(firstVisible(anchorSelector(anchor))));
      if (!pageSteps.some((step) => step.anchor)) {
        mode = "menu";
        onPrepare(mode);
        await wait(340);
        pageSteps = [];
      }
    }

    const menuVisible = menuSteps.filter((step) => Boolean(firstVisible(tourSelector(step))));
    if (mode === "page" && pageSteps.length === 0) {
      runningRef.current = false;
      setRunning(false);
      return;
    }
    if (mode === "menu" && menuVisible.length === 0) {
      runningRef.current = false;
      setRunning(false);
      return;
    }

    try {
      const { driver } = await import("driver.js");
      await import("driver.js/dist/driver.css");
      const tour = driver({
        showProgress: true,
        smoothScroll: true,
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 12,
        allowClose: true,
        disableActiveInteraction: true,
        popoverClass: "mederp-tour",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        onDestroyed: () => {
          driverRef.current = null;
          runningRef.current = false;
          setRunning(false);
          if (chainMenu.current) {
            chainMenu.current = false;
            void start("menu");
          }
        },
        steps:
          mode === "page"
            ? pageSteps.map((step) => toPageDriveStep(step, requestMenu))
            : menuVisible.map((step) => toMenuDriveStep(step)),
      });
      driverRef.current = tour;
      tour.drive();
    } catch {
      driverRef.current = null;
      runningRef.current = false;
      setRunning(false);
    }
  }

  function requestMenu() {
    chainMenu.current = true;
    driverRef.current?.destroy();
  }

  return (
    <>
      <button
        type="button"
        data-tour="take-tour"
        title={pageTour ? "Tour this page" : "Take a tour"}
        disabled={running}
        onClick={() => void start(pageTour ? "page" : "menu")}
        className="group relative flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-sm font-medium text-text-secondary hover:bg-app-bg hover:text-text-primary disabled:opacity-60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-bg text-text-secondary group-hover:bg-primary-light group-hover:text-primary">
          <TourGlyph />
        </span>
        <span
          className={`min-w-0 overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity] duration-300 ease-in-out motion-reduce:transition-none ${
            collapsed ? "md:max-w-0 md:opacity-0" : "max-w-[12rem] opacity-100"
          }`}
        >
          Take a tour
        </span>
      </button>
      {nudgeOpen && !running ? <PageTourNudge onStart={() => void start("page")} onDismiss={dismissNudge} /> : null}
    </>
  );
}

function PageTourNudge({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-label="Page tour"
      className="fixed right-4 bottom-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 shadow-card print:hidden"
    >
      <p className="text-sm font-semibold text-text-primary">Take a quick tour of this page</p>
      <p className="mt-1 text-sm text-text-secondary">
        A short walk through the buttons on this screen. You can replay it any time from the sidebar.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onStart}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
        >
          Show me
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-app-bg hover:text-text-primary"
        >
          Not now
        </button>
      </div>
    </div>,
    document.body,
  );
}

function toPageDriveStep(step: PageTourStep, onMenu: () => void) {
  return {
    element: step.anchor
      ? () => firstVisible(anchorSelector(step.anchor ?? "")) ?? document.body
      : undefined,
    popover: {
      title: step.title,
      description: step.description,
      side: (step.side ?? "bottom") as PageTourSide,
      align: "start" as const,
      onPopoverRender: step.offerMenu ? (popover: PopoverNode) => appendTourLinks(popover, onMenu) : undefined,
    },
  };
}

function toMenuDriveStep(step: TourStepDef) {
  const last = step.anchor === "take-tour";
  return {
    element: tourSelector(step),
    popover: {
      title: step.title,
      description: step.description,
      side: "right" as const,
      align: "start" as const,
      onPopoverRender: last ? (popover: PopoverNode) => appendTourLinks(popover) : undefined,
    },
  };
}

function appendTourLinks(popover: PopoverNode, onMenu?: () => void) {
  const actions = document.createElement("div");
  actions.className = "mederp-tour-actions";
  if (onMenu) {
    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "mederp-tour-menu";
    menu.textContent = "Tour the menu";
    menu.addEventListener("click", onMenu);
    actions.append(menu);
  }
  const link = document.createElement("a");
  link.href = "/guide";
  link.textContent = "Open the user guide";
  link.className = "mederp-tour-link";
  actions.append(link);
  popover.description.append(actions);
}

function anchorSelector(anchor: string) {
  return `[data-tour="${anchor}"]`;
}

function firstVisible(selector: string): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  const nodes = document.querySelectorAll(selector);
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (node.getClientRects().length === 0) continue;
    return node;
  }
  return undefined;
}

const seenListeners = new Set<() => void>();

function subscribeSeen(onStoreChange: () => void) {
  seenListeners.add(onStoreChange);
  return () => seenListeners.delete(onStoreChange);
}

function markPageTourSeen(viewerId: string, tourId: string) {
  try {
    localStorage.setItem(pageTourSeenKey(viewerId, tourId), "1");
  } catch {
    /* ignore */
  }
  for (const listener of seenListeners) listener();
}

function hasSeen(viewerId: string | undefined, tourId: string | null) {
  if (!viewerId || !tourId) return true;
  try {
    return localStorage.getItem(pageTourSeenKey(viewerId, tourId)) === "1";
  } catch {
    return true;
  }
}

function usePageTourSeen(viewerId: string | undefined, tourId: string | null) {
  return useSyncExternalStore(
    subscribeSeen,
    () => hasSeen(viewerId, tourId),
    () => true,
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function TourGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.05rem] w-[1.05rem]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" strokeLinecap="round" />
    </svg>
  );
}
