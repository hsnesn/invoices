/**
 * Simple in-memory cache for frequently used data.
 * TTL in seconds. For production, consider Redis.
 */
const cache = new Map<string, { value: unknown; expires: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCache(key: string, value: unknown, ttlSeconds = 300): void {
  cache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

export function invalidateCache(keyPrefix: string): void {
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(keyPrefix)) cache.delete(k);
  }
}
