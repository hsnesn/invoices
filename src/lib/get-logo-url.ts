/**
 * Server-side: get logo URL from static public assets.
 * Used by email, PDF generator, etc.
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const staticUrls: Record<string, string> = {
  logo_trt: `${APP_URL}/trt-logo.png`,
  logo_trt_world: `${APP_URL}/trt-world-logo.png`,
  logo_email: `${APP_URL}/logo.png`,
};

export async function getLogoUrl(key: "logo_trt" | "logo_trt_world" | "logo_email"): Promise<string> {
  return staticUrls[key] ?? staticUrls.logo_trt;
}
