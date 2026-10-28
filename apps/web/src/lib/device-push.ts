/** A phone may receive alerts only while the session that registered it is still signed in. */
export function partitionPushTokens<T extends { id: string; sessionExpiresAt: Date | null }>(
  rows: T[],
  now = new Date(),
) {
  const live: T[] = [];
  const staleIds: string[] = [];
  for (const row of rows) {
    if (row.sessionExpiresAt && row.sessionExpiresAt.getTime() > now.getTime()) live.push(row);
    else staleIds.push(row.id);
  }
  return { live, staleIds };
}

/** Token the signed-in phone asks us to drop. Empty when the client has none. */
export function deviceTokenFromLogoutBody(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const token = String((body as { deviceToken?: unknown }).deviceToken ?? "").trim();
  if (token.length < 20 || token.length > 4096) return "";
  return token;
}
