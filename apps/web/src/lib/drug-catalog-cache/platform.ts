/** Appended to the WebView user agent in the Flutter app. */
export const MEDERP_MOBILE_TOKEN = "MedERPMobile";

export function isMedErpMobileUserAgent(userAgent: string) {
  return userAgent.includes(MEDERP_MOBILE_TOKEN);
}

export function isMedErpMobileApp() {
  if (typeof navigator === "undefined") return false;
  return isMedErpMobileUserAgent(navigator.userAgent);
}
