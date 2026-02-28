/**
 * Cron endpoint authentication.
 * - Production: CRON_SECRET is required. If not set, returns 503 so cron fails until configured.
 * - Development: CRON_SECRET optional. When set, Bearer token required. When not set, allows unauthenticated (local dev).
 */
export function validateCronAuth(request: Request): Response | null {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isProduction =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  if (isProduction && !cronSecret) {
    return new Response(
      JSON.stringify({ error: "CRON_SECRET must be configured for production" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
