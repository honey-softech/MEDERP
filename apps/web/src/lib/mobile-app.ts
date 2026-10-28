import { headers } from "next/headers";
import { isMedErpMobileUserAgent } from "@/lib/drug-catalog-cache/platform";

/** Public site the mobile apps should send people to for registration and billing. */
export const MEDERP_PUBLIC_ORIGIN = "https://mederp.co.in";

export function mederpWebUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${MEDERP_PUBLIC_ORIGIN}${normalized}`;
}

/** True when the request comes from the iOS or Android WebView. */
export async function isMobileAppRequest() {
  const userAgent = (await headers()).get("user-agent") ?? "";
  return isMedErpMobileUserAgent(userAgent);
}
