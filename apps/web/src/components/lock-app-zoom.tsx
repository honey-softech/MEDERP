"use client";

import { useEffect } from "react";
import { isMedErpMobileApp } from "@/lib/drug-catalog-cache/platform";

const LOCKED_VIEWPORT =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no";

const FIELD_ZOOM_FIX =
  "html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%}input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]):not([type=reset]):not([type=hidden]):not([type=color]):not([type=image]),textarea,select{font-size:16px !important}";

function isField(node: EventTarget | null): node is HTMLElement {
  return node instanceof HTMLElement && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.tagName === "SELECT");
}

/** Installed Android and iOS apps stay at normal scale. Browser zoom is unchanged. */
export function LockAppZoom() {
  useEffect(() => {
    if (!isMedErpMobileApp()) return;

    let editing = false;
    const existing = document.getElementById("mederp-field-zoom-fix");
    const style = existing ?? document.createElement("style");
    const createdStyle = !existing;
    if (createdStyle) {
      style.id = "mederp-field-zoom-fix";
      style.textContent = FIELD_ZOOM_FIX;
      document.head.appendChild(style);
    }

    const lock = () => {
      if (editing) return;
      document.querySelectorAll('meta[name="viewport"]').forEach((meta) => {
        if (meta.getAttribute("content") !== LOCKED_VIEWPORT) {
          meta.setAttribute("content", LOCKED_VIEWPORT);
        }
      });
    };

    const onFocusIn = (event: FocusEvent) => {
      if (isField(event.target)) editing = true;
    };
    const onFocusOut = () => {
      editing = false;
      window.setTimeout(lock, 60);
    };

    lock();
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    const observer = new MutationObserver(lock);
    observer.observe(document.head, { subtree: true, attributes: true, attributeFilter: ["content"] });

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      observer.disconnect();
      if (createdStyle) style.remove();
    };
  }, []);

  return null;
}
