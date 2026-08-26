type Bucket = {
  count: number;
  resetAt: number;
  lockedUntil: number;
};

const buckets = new Map<string, Bucket>();

const CLEAN_EVERY = 200;
let ops = 0;

function prune(now: number) {
  ops += 1;
  if (ops % CLEAN_EVERY !== 0) return;
  for (const [key, bucket] of buckets) {
    if (bucket.lockedUntil < now && bucket.resetAt < now) {
      buckets.delete(key);
    }
  }
}

/** In-memory throttle for a single Node process (custom server). */
export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number; lockMs?: number },
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (existing?.lockedUntil && existing.lockedUntil > now) {
    return { ok: false, retryAfterSec: Math.ceil((existing.lockedUntil - now) / 1000) };
  }

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs, lockedUntil: 0 });
    return { ok: true };
  }

  existing.count += 1;
  if (existing.count > opts.limit) {
    const lockMs = opts.lockMs ?? opts.windowMs;
    existing.lockedUntil = now + lockMs;
    return { ok: false, retryAfterSec: Math.ceil(lockMs / 1000) };
  }

  return { ok: true };
}

export function clientKey(request: Request, suffix: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `${suffix}:${ip}`;
}
