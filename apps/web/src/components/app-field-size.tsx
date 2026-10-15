"use client";

import { useEffect } from "react";
import { isMedErpMobileApp } from "@/lib/drug-catalog-cache/platform";

const FIELD_SIZE =
  "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]):not([type=reset]):not([type=hidden]):not([type=color]):not([type=image]),textarea,select{font-size:16px !important}";

/** Stops iOS from zooming the installed app when a field is tapped. */
export function AppFieldSize() {
  useEffect(() => {
    if (!isMedErpMobileApp()) return;
    if (document.getElementById("mederp-field-size")) return;
    const style = document.createElement("style");
    style.id = "mederp-field-size";
    style.textContent = FIELD_SIZE;
    document.head.appendChild(style);
  }, []);

  return null;
}
