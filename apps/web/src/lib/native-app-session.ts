/** Same key the iOS/Android app writes when it registers for alerts. */
export const DEVICE_PUSH_TOKEN_KEY = "mederp.devicePushToken";

type NativeBridge = { postMessage: (message: string) => void };

function nativeBridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  const native = (window as Window & { MedErpNative?: NativeBridge }).MedErpNative;
  if (!native || typeof native.postMessage !== "function") return null;
  return native;
}

/** Tells the installed app to drop or restore its push registration. No-op in a browser. */
export function notifyNativeSession(type: "signed-in" | "signed-out") {
  try {
    nativeBridge()?.postMessage(JSON.stringify({ type }));
  } catch {
    // The page still signs in or out if the app bridge is unavailable.
  }
}

export function readStoredDevicePushToken() {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(DEVICE_PUSH_TOKEN_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function clearStoredDevicePushToken() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DEVICE_PUSH_TOKEN_KEY);
  } catch {
    // Private mode can block storage. Sign-out still clears the server session.
  }
}
