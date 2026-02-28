import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLoginLockoutEmailToUser, sendLoginLockoutEmailToAdmin } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 30;
const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW = 60;

export async function POST(request: NextRequest) {
  try {
    const { ok: rateLimitOk, retryAfter } = await checkRateLimit(request, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter ?? LOGIN_RATE_WINDOW) } }
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Step 1: atomic lock check (also clears expired locks)
    const { data: lockData } = await admin.rpc("check_login_lockout", { p_email: email });
    const lockRow = Array.isArray(lockData) ? lockData[0] : lockData;

    if (lockRow?.is_locked) {
      const until = lockRow.locked_until_ts
        ? new Date(lockRow.locked_until_ts).toLocaleTimeString()
        : `${LOCKOUT_MINUTES} minutes`;
      return NextResponse.json(
        { error: `Account locked. Try again after ${until}.` },
        { status: 423 }
      );
    }

    // Step 2: try authentication
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Step 3: atomically record the failure
      const { data: failData } = await admin.rpc("record_failed_login", {
        p_email: email,
        p_max_attempts: MAX_ATTEMPTS,
        p_lockout_minutes: LOCKOUT_MINUTES,
      });
      const failRow = Array.isArray(failData) ? failData[0] : failData;

      if (failRow?.is_locked) {
        sendLoginLockoutEmailToUser(email).catch(() => {});
        sendLoginLockoutEmailToAdmin(email).catch(() => {});
        const until = failRow.locked_until_ts
          ? new Date(failRow.locked_until_ts).toLocaleTimeString()
          : `${LOCKOUT_MINUTES} minutes`;
        return NextResponse.json(
          { error: `Too many failed attempts. Account locked until ${until}.` },
          { status: 423 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Success: clear failed attempts
    if (data.session) {
      await admin.from("login_failed_attempts").delete().eq("email", email);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/login]", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
