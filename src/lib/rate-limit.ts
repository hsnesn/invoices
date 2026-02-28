/**
 * Rate limiter for API routes.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set (production).
 * Falls back to in-memory when not configured (development).
 */
const store = new Map<string, { count: number; resetAt: number }>();

function inMemoryRateLimit(key: string, limit: number, windowSeconds: number): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1 };
  }

  if (now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: limit - entry.count };
}

export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  const path = new URL(request.url).pathname;
  return `${path}:${ip}`;
}

export function rateLimit(key: string, limit: number, windowSeconds: number): { ok: boolean; remaining: number } {
  return inMemoryRateLimit(key, limit, windowSeconds);
}

/** Check rate limit from request, 60 req/min per IP+path. Returns { ok, retryAfter? }. */
export async function checkRateLimit(request: Request): Promise<{ ok: boolean; retryAfter?: number }> {
  const key = getRateLimitKey(request);

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const { Redis } = await import("@upstash/redis");
      const ratelimit = new Ratelimit({
        redis: new Redis({ url: redisUrl, token: redisToken }),
        limiter: Ratelimit.slidingWindow(60, "60 s"),
      });
      const { success, reset } = await ratelimit.limit(key);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return { ok: false, retryAfter: Math.max(1, retryAfter) };
      }
      return { ok: true };
    } catch (e) {
      console.warn("[rate-limit] Upstash failed, falling back to in-memory:", (e as Error).message);
    }
  }

  const result = inMemoryRateLimit(key, 60, 60);
  if (!result.ok) {
    return { ok: false, retryAfter: 60 };
  }
  return { ok: true };
}
