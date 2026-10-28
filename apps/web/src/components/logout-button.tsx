"use client";

import { useRouter } from "next/navigation";
import { clearStoredDevicePushToken, notifyNativeSession, readStoredDevicePushToken } from "@/lib/native-app-session";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    const deviceToken = readStoredDevicePushToken();
    notifyNativeSession("signed-out");
    clearStoredDevicePushToken();
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deviceToken ? { deviceToken } : {}),
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      className="h-9 shrink-0 rounded-full bg-primary-light px-3 text-xs font-medium text-primary-dark hover:bg-primary-light/80"
    >
      Sign out
    </button>
  );
}
