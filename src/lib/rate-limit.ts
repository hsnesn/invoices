/**
 * Simple in-memory rate limiter for API routes.
 * For production with multiple instances, use Redis (e.g. @upstash/ratelimit).
 */
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowSeconds: number): { ok: boolean; remaining: number } {
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

/** Legacy API: check rate limit from request, 60 req/min per IP+path. Returns { ok, retryAfter? }. */
export function checkRateLimit(request: Request): { ok: boolean; retryAfter?: number } {
  const key = getRateLimitKey(request);
  const result = rateLimit(key, 60, 60);
  if (!result.ok) {
    return { ok: false, retryAfter: 60 };
  }
  return { ok: true };
}
