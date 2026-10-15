"use client";

import { useEffect } from "react";
import { isMedErpMobileApp } from "@/lib/drug-catalog-cache/platform";

const LOCKED_VIEWPORT =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no";

/** Installed Android and iOS apps stay at normal scale. Browser zoom is unchanged. */
export function LockAppZoom() {
  useEffect(() => {
    if (!isMedErpMobileApp()) return;

    const lock = () => {
      document.querySelectorAll('meta[name="viewport"]').forEach((meta) => {
        if (meta.getAttribute("content") !== LOCKED_VIEWPORT) {
          meta.setAttribute("content", LOCKED_VIEWPORT);
        }
      });
      document.documentElement.style.touchAction = "pan-x pan-y";
      document.body.style.touchAction = "pan-x pan-y";
    };

    lock();
    const metas = document.querySelectorAll('meta[name="viewport"]');
    const observer = new MutationObserver(lock);
    metas.forEach((meta) => observer.observe(meta, { attributes: true, attributeFilter: ["content"] }));
    return () => observer.disconnect();
  }, []);

  return null;
}
