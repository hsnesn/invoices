import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getClientIp,
  createSignedIpCookie,
  verifyIpCookie,
  getIpBoundCookie,
  getIpCookieOptions,
} from "@/lib/ip-binding";
import { getMfaCookieName } from "@/lib/mfa-cookie";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn("Supabase URL or ANON_KEY missing. Check .env.local file.");
    return NextResponse.next({ request: { headers: request.headers } });
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          });
        },
      },
    }
  );

  // getClaims() validates JWT and refreshes token if needed - required to prevent random logouts
  const { data: claimsData } = await supabase.auth.getClaims();
  const hasSession = !!claimsData?.claims?.sub;

  // IP binding: if session exists and secret is configured, bind session to IP
  // Skip in development (localhost IP is unreliable)
  if (hasSession) {
    const secret = process.env.SESSION_IP_SECRET;
    const isProduction = process.env.NODE_ENV === "production";
    const clientIp = getClientIp(request);
    const isLocalhost = ["127.0.0.1", "::1", "unknown"].includes(clientIp);

    if (secret && isProduction && !isLocalhost) {
      const ipBoundValue = request.cookies.get(getIpBoundCookie())?.value;

      if (!ipBoundValue) {
        // First request after login: set IP cookie (only when we have a real IP)
        if (clientIp !== "unknown") {
          const signed = await createSignedIpCookie(clientIp);
          if (signed) {
            response.cookies.set(getIpBoundCookie(), signed, getIpCookieOptions());
          }
        }
      } else {
        // Skip verification when we cannot reliably get current IP (e.g. proxy not forwarding headers)
        if (clientIp === "unknown") {
          // Allow request - blocking would cause "Session expired" on every click for some deployments
        } else if (!(await verifyIpCookie(ipBoundValue, clientIp))) {
          const redirectResponse = NextResponse.redirect(
            new URL("/login?error=" + encodeURIComponent("Session expired. Please log in again from this device."), request.url)
          );
          redirectResponse.cookies.delete(getIpBoundCookie());
          const signOutSupabase = createServerClient(url, key, {
            cookies: {
              getAll: () => request.cookies.getAll(),
              setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
                cookiesToSet.forEach(({ name, value, options }) => {
                  redirectResponse.cookies.set(name, value, options as Parameters<typeof redirectResponse.cookies.set>[2]);
                });
              },
            },
          });
          await signOutSupabase.auth.signOut();
          return redirectResponse;
        }
      }
    }
  } else {
    // No session: clear ip_bound and mfa_verified cookies
    if (request.cookies.get(getIpBoundCookie())) {
      response.cookies.delete(getIpBoundCookie());
    }
    if (request.cookies.get(getMfaCookieName())) {
      response.cookies.delete(getMfaCookieName());
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
