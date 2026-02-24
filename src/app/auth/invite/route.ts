import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * GET /auth/invite?token=UUID
 * Validates invite token, generates fresh Supabase magic link, redirects.
 * Token is multi-use until: accepted OR 24h expiry.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token");
  const origin = requestUrl.origin;

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("Invitation link is invalid. Missing token."), origin)
    );
  }

  const supabase = createAdminClient();

  // Validate token: exists, not expired, not accepted
  const { data: inv, error: invError } = await supabase
    .from("user_invitations")
    .select("id, email, accepted, token_expires_at")
    .eq("invite_token", token)
    .single();

  if (invError || !inv) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("Invitation link is invalid or has been revoked."), origin)
    );
  }

  if (inv.accepted) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("This invitation has already been accepted. Please log in with your password."), origin)
    );
  }

  const expiresAt = inv.token_expires_at ? new Date(inv.token_expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("This invitation link has expired. Please ask your administrator to resend the invitation."), origin)
    );
  }

  // Generate fresh Supabase magic link (single-use, but we create new one each time)
  const nextPath = "/auth/accept-invite";
  const emailNorm = (inv.email as string).toLowerCase().trim();
  let magicLink: string | undefined;

  for (const type of ["invite", "magiclink"] as const) {
    const { data, error } = await supabase.auth.admin.generateLink({
      type,
      email: emailNorm,
      options: { redirectTo: `${APP_URL}/auth/callback` },
    });
    const hash = data?.properties?.hashed_token;
    if (hash) {
      magicLink = `${APP_URL}/auth/callback?token_hash=${encodeURIComponent(hash)}&next=${encodeURIComponent(nextPath)}`;
      break;
    }
    if (error && type === "invite") {
      console.warn("invite link failed, trying magiclink:", error.message);
    }
  }

  if (!magicLink) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("Failed to generate sign-in link. Please try again or ask your administrator to resend."), origin)
    );
  }

  return NextResponse.redirect(magicLink);
}
