"use client";

import { cardClass, fieldClass } from "@/lib/ui";

export const SETTINGS_TABS = [
  {
    id: "profile",
    label: "Hospital profile",
    description: "Name, address, phones, logo, seal, and the default OPD fee.",
  },
  {
    id: "front-desk",
    label: "Front desk and access",
    description: "Who can register walk-ins, and whether nurses cover the front desk.",
  },
  {
    id: "communication",
    label: "Patient communication",
    description: "Language for patient WhatsApp messages, and follow-up reminders.",
  },
  {
    id: "doctors",
    label: "Doctors",
    description: "Consultation hours, and practising on this admin login.",
  },
  {
    id: "policies",
    label: "Policies",
    description: "Visit-summary signatures and AI consult scribe.",
  },
  {
    id: "danger",
    label: "Danger zone",
    description: "Closing the hospital releases logins and stops the subscription.",
  },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export function isSettingsTab(value: string | null): value is SettingsTabId {
  return SETTINGS_TABS.some((tab) => tab.id === value);
}

export function SettingsLayout({
  tab,
  onTab,
  children,
}: {
  tab: SettingsTabId;
  onTab: (tab: SettingsTabId) => void;
  children: React.ReactNode;
}) {
  const current = SETTINGS_TABS.find((item) => item.id === tab) ?? SETTINGS_TABS[0];
  const danger = current.id === "danger";

  return (
    <div className="grid items-start gap-4 md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
      <label data-tour="page:settings-nav" className="text-sm font-medium text-text-primary md:hidden">
        Section
        <select
          className={fieldClass}
          value={tab}
          aria-label="Settings section"
          onChange={(event) => onTab(event.target.value as SettingsTabId)}
        >
          {SETTINGS_TABS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <nav data-tour="page:settings-nav" className="hidden md:block" aria-label="Settings sections">
        <ul className="space-y-1">
          {SETTINGS_TABS.map((item) => {
            const active = item.id === tab;
            const dangerItem = item.id === "danger";
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onTab(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    active
                      ? dangerItem
                        ? "bg-critical-bg text-critical"
                        : "bg-primary-light text-primary"
                      : dangerItem
                        ? "text-critical hover:bg-critical-bg"
                        : "text-text-primary hover:bg-app-bg"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section data-tour="page:settings-panel" className={`${cardClass} p-4 sm:p-6 ${danger ? "border-critical" : ""}`}>
        <h3 className={`text-lg font-semibold ${danger ? "text-critical" : "text-text-primary"}`}>{current.label}</h3>
        <p className="mt-1 text-sm text-text-secondary">{current.description}</p>
        <div className="mt-2">{children}</div>
      </section>
    </div>
  );
}
