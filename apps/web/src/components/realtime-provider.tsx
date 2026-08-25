"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { REALTIME_EVENTS, type StaffNotice } from "@/lib/realtime-events";

type RealtimeContextValue = {
  items: StaffNotice[];
  unreadCount: number;
  connected: boolean;
  mark: (ids?: string[]) => Promise<void>;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtime() {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("useRealtime must be used within RealtimeProvider");
  return value;
}

function socketUrl() {
  return process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
}

function showDeviceNotification(notice: StaffNotice, onOpen: (href: string) => void) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;
  const push = new Notification(notice.title, {
    body: notice.body,
    tag: notice.id,
    silent: false,
  });
  push.onclick = () => {
    window.focus();
    if (notice.href) onOpen(notice.href);
    push.close();
  };
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(180);
  }
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<StaffNotice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<StaffNotice | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) return;
    const data = (await response.json()) as { notifications?: StaffNotice[]; unreadCount?: number };
    setItems(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }, []);

  const applyRead = useCallback((payload: { ids?: string[]; all?: boolean }) => {
    setItems((current) =>
      current.map((item) =>
        payload.all || payload.ids?.includes(item.id) ? { ...item, isRead: true } : item,
      ),
    );
    setUnreadCount((current) => {
      if (payload.all) return 0;
      if (!payload.ids?.length) return current;
      return Math.max(0, current - payload.ids.length);
    });
  }, []);

  const mark = useCallback(
    async (ids?: string[]) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { all: true }),
      });
      applyRead(ids ? { ids } : { all: true });
    },
    [applyRead],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const socket: Socket = io(socketUrl(), {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on(REALTIME_EVENTS.notification, (notice: StaffNotice) => {
      setItems((current) => [notice, ...current.filter((item) => item.id !== notice.id)].slice(0, 40));
      if (!notice.isRead) setUnreadCount((current) => current + 1);
      setToast(notice);
      showDeviceNotification(notice, (href) => router.push(href));
      router.refresh();
    });
    socket.on(REALTIME_EVENTS.notificationsRead, applyRead);
    socket.on(REALTIME_EVENTS.helpdeskTicket, () => {
      router.refresh();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [applyRead, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo(
    () => ({ items, unreadCount, connected, mark }),
    [items, unreadCount, connected, mark],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      {toast ? (
        <button
          type="button"
          className="fixed inset-x-3 top-3 z-[60] rounded-2xl border border-slate-200 bg-white/95 p-3 text-left shadow-xl backdrop-blur md:inset-x-auto md:right-4 md:top-20 md:w-[22rem]"
          onClick={() => {
            if (toast.href) router.push(toast.href);
            void mark([toast.id]);
            setToast(null);
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">MedERP</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{toast.title}</p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">{toast.body}</p>
        </button>
      ) : null}
    </RealtimeContext.Provider>
  );
}
