/**
 * IP binding for session security.
 * Binds the session to the IP used at login. If IP changes, user must re-login.
 * Uses Web Crypto API (Edge-compatible).
 */
const COOKIE_NAME = "ip_bound";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string | null {
  return process.env.SESSION_IP_SECRET ?? null;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() ?? realIp?.trim() ?? "unknown";
  return ip || "unknown";
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function createSignedIpCookie(ip: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${ip}:${timestamp}`;
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyIpCookie(
  cookieValue: string,
  currentIp: string
): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = await hmacSha256Hex(secret, payload);
  if (!timingSafeEqual(sig, expected)) return false;
  const [storedIp] = payload.split(":");
  return storedIp === currentIp;
}

export function getIpBoundCookie(): string {
  return COOKIE_NAME;
}

export function getIpCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  };
}
