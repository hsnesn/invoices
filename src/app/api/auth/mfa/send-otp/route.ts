import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMfaOtpEmail } from "@/lib/email";
import { roleRequiresMfa } from "@/lib/mfa";

const OTP_EXPIRY_MINUTES = 10;
const RATE_LIMIT_MINUTES = 1;
/** In-memory cooldown to prevent duplicate sends from parallel requests (e.g. Strict Mode double-mount) */
const SEND_COOLDOWN_MS = 5000;
const lastSendByUser = new Map<string, number>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;
    const t = Date.now();
    const last = lastSendByUser.get(userId) ?? 0;
    if (t - last < SEND_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Please wait a few seconds before requesting a new code" },
        { status: 429 }
      );
    }
    lastSendByUser.set(userId, t);
    setTimeout(() => lastSendByUser.delete(userId), SEND_COOLDOWN_MS);

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (!profile || !roleRequiresMfa((profile as { role: string }).role)) {
      return NextResponse.json({ error: "MFA not required for your role" }, { status: 400 });
    }

    const now = new Date();
    const rateLimitSince = new Date(now.getTime() - RATE_LIMIT_MINUTES * 60 * 1000);

    const { data: recent } = await admin
      .from("mfa_otp_codes")
      .select("id")
      .eq("user_id", session.user.id)
      .gte("created_at", rateLimitSince.toISOString())
      .limit(1);

    if ((recent ?? []).length > 0) {
      return NextResponse.json(
        { error: `Please wait ${RATE_LIMIT_MINUTES} minute(s) before requesting a new code` },
        { status: 429 }
      );
    }

    const code = generateOtp();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await admin.from("mfa_otp_codes").delete().eq("user_id", session.user.id);

    await admin.from("mfa_otp_codes").insert({
      user_id: session.user.id,
      code,
      expires_at: expiresAt.toISOString(),
    });

    const { success, error } = await sendMfaOtpEmail(session.user.email, code);
    if (!success) {
      return NextResponse.json({ error: error ?? "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
