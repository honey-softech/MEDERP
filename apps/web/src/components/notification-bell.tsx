"use client";

import Link from "next/link";
import { useState } from "react";
import { useRealtime } from "@/components/realtime-provider";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { items, unreadCount, connected, mark } = useRealtime();

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-primary hover:bg-app-bg"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M9 17a3 3 0 0 0 6 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
        <span
          className={`absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`}
          title={connected ? "Live" : "Connecting…"}
        />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 bg-slate-900/40 md:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-3 top-[4.5rem] z-50 flex max-h-[min(28rem,calc(100dvh-6rem))] w-auto flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-[22rem]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 ? (
                <button type="button" className="shrink-0 text-xs font-medium text-teal-700 hover:underline" onClick={() => void mark()}>
                  Mark all read
                </button>
              ) : null}
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {items.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</li>
              ) : (
                items.map((item) => (
                  <li key={item.id} className={item.isRead ? "border-t border-slate-50" : "border-t border-slate-50 bg-teal-50/60"}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="block px-4 py-3"
                        onClick={() => {
                          if (!item.isRead) void mark([item.id]);
                          setOpen(false);
                        }}
                      >
                        <p className="break-words text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.body}</p>
                      </Link>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="break-words text-sm font-medium">{item.title}</p>
                        <p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.body}</p>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
