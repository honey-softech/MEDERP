import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseReferralSamples } from "@/lib/referral-tracking";

const LOCAL_REFERRAL_SAMPLES_FILE = path.join(process.cwd(), "src/lib/referral-tracking.local.json");

/** Local stand-in rows for the tracking board. Production never reads this file. */
export async function loadLocalReferralSamples(now = new Date()) {
  if (process.env.NODE_ENV === "production") return [];
  try {
    const raw = await readFile(LOCAL_REFERRAL_SAMPLES_FILE, "utf8");
    return parseReferralSamples(raw, now);
  } catch {
    return [];
  }
}
