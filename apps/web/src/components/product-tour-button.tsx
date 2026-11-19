"use client";

import { useState } from "react";
import { getTourSteps, tourSelector, type TourStepDef } from "@/lib/tour-steps";

export function ProductTourButton({
  role,
  hrefs,
  includeViewMode,
  collapsed,
  onBeforeStart,
}: {
  role?: string;
  hrefs: string[];
  includeViewMode: boolean;
  collapsed: boolean;
  onBeforeStart: () => void;
}) {
  const [running, setRunning] = useState(false);
  const steps = getTourSteps(role, hrefs, includeViewMode);
  if (steps.length === 0) return null;

  async function start() {
    if (running) return;
    setRunning(true);
    onBeforeStart();
    await new Promise((resolve) => setTimeout(resolve, 340));
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
        onDestroyed: () => setRunning(false),
        steps: steps.map((step) => toDriveStep(step)),
      });
      tour.drive();
    } catch {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      data-tour="take-tour"
      title="Take a tour"
      disabled={running}
      onClick={() => void start()}
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
  );
}

function toDriveStep(step: TourStepDef) {
  const last = step.anchor === "take-tour";
  return {
    element: tourSelector(step),
    popover: {
      title: step.title,
      description: step.description,
      side: "right" as const,
      align: "start" as const,
      onPopoverRender: last
        ? (popover: { description: HTMLElement }) => {
            const link = document.createElement("a");
            link.href = "/guide";
            link.textContent = "Open the user guide";
            link.className = "mederp-tour-link";
            popover.description.append(document.createElement("br"), link);
          }
        : undefined,
    },
  };
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
