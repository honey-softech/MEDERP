"use client";

import { useEffect } from "react";
import { SESSION_PING_MS } from "@/lib/session-policy";

export function SessionKeepAlive() {
  useEffect(() => {
    let cancelled = false;

    async function ping() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/session/ping", { method: "POST", credentials: "same-origin" });
        if (response.status === 401) {
          window.location.assign("/login");
        }
      } catch {
        /* network blip — stay on the page */
      }
    }

    void ping();
    const timer = window.setInterval(() => void ping(), SESSION_PING_MS);
    function onVisible() {
      if (document.visibilityState === "visible") void ping();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
