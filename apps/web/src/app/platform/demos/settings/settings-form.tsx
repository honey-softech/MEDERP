"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

type Settings = {
  durationMins: number;
  bufferMins: number;
  timezone: string;
  lookAheadDays: number;
  dayStartMin: number;
  dayEndMin: number;
  notifyEmail: string | null;
};

function minutesToTime(minutes: number) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function DemoSettingsForm({
  notice,
}: {
  notice?: string;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetch("/api/platform/demos/settings")
      .then((response) => response.json())
      .then((data) => {
        setSettings(data.settings);
        setConnected(data.connection?.status === "CONNECTED");
        setConnectedEmail(data.connection?.googleEmail ?? null);
        setGoogleReady(Boolean(data.googleConfigured));
      });
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setPending(true);
    setError("");
    setSaved(false);
    const response = await fetch("/api/platform/demos/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }
    setSettings(data.settings);
    setSaved(true);
    router.refresh();
  }

  async function disconnect() {
    setPending(true);
    await fetch("/api/platform/demos/google/disconnect", { method: "POST" });
    setPending(false);
    setConnected(false);
    setConnectedEmail(null);
  }

  if (!settings) return <p className="text-sm text-slate-500">Loading settings…</p>;

  return (
    <div className="max-w-xl space-y-6">
      {notice ? <p className="text-sm text-teal-800">{notice}</p> : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-900">Google Calendar</p>
        <p className="mt-1 text-sm text-slate-500">
          {connected
            ? `Connected${connectedEmail ? ` as ${connectedEmail}` : ""}.`
            : "Not connected. Busy times on this calendar block public slots."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className={secondaryButtonClass} href="/api/platform/demos/google/connect">
            {connected ? "Reconnect Google Calendar" : "Connect Google Calendar"}
          </a>
          {connected ? (
            <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void disconnect()}>
              Disconnect
            </button>
          ) : null}
        </div>
        {!googleReady ? (
          <p className="mt-2 text-xs text-amber-800">Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before connecting.</p>
        ) : null}
      </div>
      <form onSubmit={save} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block text-sm font-medium text-slate-700">
          Duration (minutes)
          <input
            className={`${fieldClass} mt-1`}
            type="number"
            min={15}
            max={120}
            value={settings.durationMins}
            onChange={(event) => setSettings({ ...settings, durationMins: Number(event.target.value) })}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Buffer (minutes)
          <input
            className={`${fieldClass} mt-1`}
            type="number"
            min={0}
            max={60}
            value={settings.bufferMins}
            onChange={(event) => setSettings({ ...settings, bufferMins: Number(event.target.value) })}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Timezone
          <input
            className={`${fieldClass} mt-1`}
            value={settings.timezone}
            onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Days ahead
          <input
            className={`${fieldClass} mt-1`}
            type="number"
            min={1}
            max={60}
            value={settings.lookAheadDays}
            onChange={(event) => setSettings({ ...settings, lookAheadDays: Number(event.target.value) })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-700">
            Day starts
            <input
              className={`${fieldClass} mt-1`}
              type="time"
              value={minutesToTime(settings.dayStartMin)}
              onChange={(event) => setSettings({ ...settings, dayStartMin: timeToMinutes(event.target.value) })}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Day ends
            <input
              className={`${fieldClass} mt-1`}
              type="time"
              value={minutesToTime(settings.dayEndMin)}
              onChange={(event) => setSettings({ ...settings, dayEndMin: timeToMinutes(event.target.value) })}
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Sales notify email
          <input
            className={`${fieldClass} mt-1`}
            type="email"
            value={settings.notifyEmail ?? ""}
            onChange={(event) => setSettings({ ...settings, notifyEmail: event.target.value || null })}
            placeholder="Falls back to DEMO_NOTIFY_EMAIL"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved ? <p className="text-sm text-teal-800">Settings saved.</p> : null}
        <button className={primaryButtonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
