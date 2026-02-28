/**
 * Signed MFA verification cookie. Edge-compatible (Web Crypto).
 */
const COOKIE_NAME = "mfa_verified";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days (same session duration)

function getSecret(): string | null {
  return process.env.SESSION_IP_SECRET ?? process.env.CRON_SECRET ?? null;
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
  const payload = userId;
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyMfaCookie(
  cookieValue: string,
  userId: string
): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = await hmacSha256Hex(secret, payload);
  if (!timingSafeEqual(sig, expected)) return false;
  return payload === userId;
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
