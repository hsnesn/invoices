/**
 * Signed MFA verification cookie. Edge-compatible (Web Crypto).
 */
const COOKIE_NAME = "mfa_verified";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days (same session duration)

function getSecret(): string | null {
  return process.env.MFA_COOKIE_SECRET ?? null;
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

export function getMfaCookieName(): string {
  return COOKIE_NAME;
}

export async function createMfaVerifiedCookie(userId: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const payload = `${userId}:${Math.floor(Date.now() / 1000)}`;
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyMfaCookie(
  cookieValue: string,
  userId: string
): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  const dotIdx = cookieValue.lastIndexOf(".");
  if (dotIdx === -1) return false;
  const payload = cookieValue.slice(0, dotIdx);
  const sig = cookieValue.slice(dotIdx + 1);
  const expected = await hmacSha256Hex(secret, payload);
  if (!timingSafeEqual(sig, expected)) return false;
  const colonIdx = payload.indexOf(":");
  if (colonIdx === -1) return false;
  const cookieUserId = payload.slice(0, colonIdx);
  const issuedAt = parseInt(payload.slice(colonIdx + 1), 10);
  if (cookieUserId !== userId) return false;
  const age = Math.floor(Date.now() / 1000) - issuedAt;
  if (age < 0 || age > MAX_AGE) return false;
  return true;
}

export function getMfaCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE,
    path: "/",
  };
}
