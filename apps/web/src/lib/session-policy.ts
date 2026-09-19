export const SESSION_COOKIE = "mederp_session";
export const MAX_SESSIONS_PER_USER = 2;
export const SESSION_IDLE_MS = 2 * 24 * 60 * 60 * 1000;
export const SESSION_REFRESH_THROTTLE_MS = 5 * 60 * 1000;
export const SESSION_PING_MS = 15 * 60 * 1000;

export function sessionExpiresAt(from = new Date()) {
  return new Date(from.getTime() + SESSION_IDLE_MS);
}

export function shouldRefreshSession(lastSeenAt: Date, now = new Date()) {
  return now.getTime() - lastSeenAt.getTime() >= SESSION_REFRESH_THROTTLE_MS;
}

export function extraSessionIds(
  sessions: { id: string; lastSeenAt: Date }[],
  max = MAX_SESSIONS_PER_USER,
) {
  return [...sessions]
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
    .slice(Math.max(0, max))
    .map((row) => row.id);
}

export function sessionCookieSecure() {
  const explicit = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === "0" || explicit === "false") return false;
  if (explicit === "1" || explicit === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: sessionCookieSecure(),
    path: "/",
    expires: expiresAt,
  };
}
