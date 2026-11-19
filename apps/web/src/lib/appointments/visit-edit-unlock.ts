import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sessionCookieSecure } from "@/lib/session-policy";

export const VISIT_EDIT_UNLOCK_COOKIE = "mederp_visit_edit";
export const VISIT_EDIT_UNLOCK_TTL_MS = 15 * 60 * 1000;
export const VISIT_EDIT_REASON_MIN = 10;
export const VISIT_EDIT_REASON_MAX = 500;
export const VISIT_EDIT_UNLOCK_FAIL_LIMIT = 5;
export const VISIT_EDIT_UNLOCK_FAIL_WINDOW_MS = 15 * 60 * 1000;

type UnlockPayload = {
  u: string;
  a: string;
  exp: number;
  r: string;
};

export type VisitEditUnlock = {
  reason: string;
  expiresAt: number;
};

function unlockSecret() {
  return process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "mederp-visit-edit-unlock";
}

function signBody(body: string) {
  return createHmac("sha256", unlockSecret()).update(body).digest("base64url");
}

export function issueVisitEditUnlock(input: {
  userId: string;
  appointmentId: string;
  reason: string;
  now?: number;
}) {
  const reason = input.reason.trim().slice(0, VISIT_EDIT_REASON_MAX);
  const exp = (input.now ?? Date.now()) + VISIT_EDIT_UNLOCK_TTL_MS;
  const payload: UnlockPayload = {
    u: input.userId,
    a: input.appointmentId,
    exp,
    r: reason,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    token: `${body}.${signBody(body)}`,
    expiresAt: new Date(exp),
    reason,
  };
}

export function readVisitEditUnlockToken(
  token: string | undefined | null,
  expected: { userId: string; appointmentId: string },
  now = Date.now(),
): VisitEditUnlock | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = signBody(body);
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expectedSig);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  let payload: UnlockPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UnlockPayload;
  } catch {
    return null;
  }
  if (!payload || payload.u !== expected.userId || payload.a !== expected.appointmentId) return null;
  if (!Number.isFinite(payload.exp) || payload.exp < now) return null;
  const reason = String(payload.r ?? "").trim();
  if (reason.length < VISIT_EDIT_REASON_MIN) return null;
  return { reason, expiresAt: payload.exp };
}

export function visitEditUnlockCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: sessionCookieSecure(),
    path: "/",
    expires: expiresAt,
  };
}

export async function currentVisitEditUnlock(expected: { userId: string; appointmentId: string }) {
  const jar = await cookies();
  return readVisitEditUnlockToken(jar.get(VISIT_EDIT_UNLOCK_COOKIE)?.value, expected);
}
