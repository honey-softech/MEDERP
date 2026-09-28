import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { sessionCookieSecure } from "@/lib/session-policy";

export const DEMO_OAUTH_COOKIE = "demo_oauth_state";

function hashesMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Issued while the admin is signed in. SameSite=Lax so Google's redirect can send it back. */
export async function issueOauthState(userId: string) {
  const state = randomBytes(24).toString("hex");
  const jar = await cookies();
  const hash = createHash("sha256").update(state).digest("hex");
  jar.set(DEMO_OAUTH_COOKIE, `${hash}.${userId}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 10 * 60,
  });
  return state;
}

export async function consumeOauthState(state: string | null) {
  const jar = await cookies();
  const stored = jar.get(DEMO_OAUTH_COOKIE)?.value;
  jar.delete(DEMO_OAUTH_COOKIE);
  if (!state || !stored) return null;
  const splitAt = stored.indexOf(".");
  if (splitAt <= 0) return null;
  const hash = stored.slice(0, splitAt);
  const userId = stored.slice(splitAt + 1);
  if (!userId) return null;
  const expected = createHash("sha256").update(state).digest("hex");
  return hashesMatch(hash, expected) ? userId : null;
}
