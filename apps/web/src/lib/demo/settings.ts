import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "default";

export async function getDemoSettings() {
  return prisma.demoSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export async function updateDemoSettings(input: {
  durationMins: number;
  bufferMins: number;
  timezone: string;
  lookAheadDays: number;
  dayStartMin: number;
  dayEndMin: number;
  notifyEmail: string | null;
}) {
  if (!Number.isInteger(input.durationMins) || input.durationMins < 15 || input.durationMins > 120) {
    throw new Error("Duration must be between 15 and 120 minutes.");
  }
  if (!Number.isInteger(input.bufferMins) || input.bufferMins < 0 || input.bufferMins > 60) {
    throw new Error("Buffer must be between 0 and 60 minutes.");
  }
  if (!Number.isInteger(input.lookAheadDays) || input.lookAheadDays < 1 || input.lookAheadDays > 60) {
    throw new Error("Booking window must be between 1 and 60 days.");
  }
  if (
    !Number.isInteger(input.dayStartMin) ||
    !Number.isInteger(input.dayEndMin) ||
    input.dayStartMin < 0 ||
    input.dayEndMin > 24 * 60 ||
    input.dayEndMin - input.dayStartMin < input.durationMins
  ) {
    throw new Error("Working hours must fit at least one demo.");
  }
  if (!isValidTimeZone(input.timezone)) {
    throw new Error("Timezone is not valid.");
  }
  if (input.notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.notifyEmail)) {
    throw new Error("Notify email is not valid.");
  }
  return prisma.demoSettings.upsert({
    where: { id: SETTINGS_ID },
    update: input,
    create: { id: SETTINGS_ID, ...input },
  });
}

export function notifyAddress(settingsNotify: string | null | undefined) {
  return settingsNotify?.trim() || process.env.DEMO_NOTIFY_EMAIL?.trim() || null;
}

export function publicBaseUrl() {
  const api = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/^["']|["']$/g, "").replace(/\/$/, "");
  if (api && !/localhost|127\.0\.0\.1/i.test(api)) return api;
  const site = (process.env.SITE_ADDRESS ?? "").split(",")[0]?.trim();
  if (site && !/localhost|127\.0\.0\.1/i.test(site)) {
    return site.includes("://") ? site.replace(/\/$/, "") : `https://${site}`;
  }
  return "https://mederp.co.in";
}
