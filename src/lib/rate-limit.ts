/**
 * Simple in-memory rate limiter. Use for development/single-instance.
 * For production with multiple instances, consider Redis-based solution.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute per IP

function getClientId(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkRateLimit(headers: Headers): { ok: boolean; retryAfter?: number } {
  const id = getClientId(headers);
  const now = Date.now();
  let entry = store.get(id);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(id, entry);
  }

  entry.count += 1;

  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    Array.from(store.entries()).forEach(([k, v]) => {
      if (now > v.resetAt) store.delete(k);
    });
  }

  if (entry.count > MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}
