"use client";

import { useSyncExternalStore } from "react";
import { isMedErpMobileApp } from "@/lib/drug-catalog-cache/platform";

function subscribe() {
  return () => {};
}

/** Client-side mobile-app check. The server snapshot stays false so the first render matches the HTML. */
export function useIsMedErpMobileApp() {
  return useSyncExternalStore(subscribe, isMedErpMobileApp, () => false);
}
