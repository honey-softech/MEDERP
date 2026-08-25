"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
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
