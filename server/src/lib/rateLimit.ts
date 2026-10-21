export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

/** Fixed-window, in-memory limiter. Per-process: put a shared store behind it if the API scales out. */
export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  const entries = new Map<string, Entry>();

  function hit(key: string, now = Date.now()): RateLimitResult {
    const current = entries.get(key);
    if (!current || now >= current.resetAt) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (current.count >= max) {
      return { allowed: false, retryAfterMs: current.resetAt - now };
    }
    current.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  function sweep(now = Date.now()) {
    for (const [key, entry] of entries) {
      if (now >= entry.resetAt) entries.delete(key);
    }
  }

  return { hit, sweep, size: () => entries.size };
}
