import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createMfaVerifiedCookie,
  getMfaCookieName,
  getMfaCookieOptions,
} from "@/lib/mfa-cookie";
import { roleRequiresMfa } from "@/lib/mfa";
import { checkRateLimit } from "@/lib/rate-limit";

const MFA_VERIFY_LIMIT = 5;
const MFA_VERIFY_WINDOW = 60;
const MAX_MFA_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const { ok: rateLimitOk, retryAfter } = await checkRateLimit(request, MFA_VERIFY_LIMIT, MFA_VERIFY_WINDOW);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter ?? MFA_VERIFY_WINDOW) } }
      );
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const code = (body?.code as string)?.trim();
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (!profile || !roleRequiresMfa((profile as { role: string }).role)) {
      return NextResponse.json({ error: "MFA not required" }, { status: 400 });
    }

    const { data: otpRow } = await admin
      .from("mfa_otp_codes")
      .select("id, verify_attempts")
      .eq("user_id", session.user.id)
      .gte("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (!otpRow) {
      return NextResponse.json({ error: "No active code. Please request a new one." }, { status: 400 });
    }

    const attempts = (otpRow.verify_attempts ?? 0) + 1;
    if (attempts > MAX_MFA_ATTEMPTS) {
      await admin.from("mfa_otp_codes").delete().eq("user_id", session.user.id);
      return NextResponse.json(
        { error: "Too many failed attempts. Code invalidated. Please request a new one." },
        { status: 429 }
      );
    }

    const { data: matchRow } = await admin
      .from("mfa_otp_codes")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("code", code)
      .gte("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (!matchRow) {
      await admin
        .from("mfa_otp_codes")
        .update({ verify_attempts: attempts })
        .eq("id", otpRow.id);
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    await admin.from("mfa_otp_codes").delete().eq("user_id", session.user.id);

    const cookieValue = await createMfaVerifiedCookie(session.user.id);
    if (!cookieValue) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(getMfaCookieName(), cookieValue, getMfaCookieOptions());
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
