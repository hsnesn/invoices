import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLoginLockoutEmailToUser, sendLoginLockoutEmailToAdmin } from "@/lib/email";

const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: row } = await admin
      .from("login_failed_attempts")
      .select("attempt_count, locked_until")
      .eq("email", email)
      .single();

    const now = new Date();
    const lockedUntil = row?.locked_until ? new Date(row.locked_until) : null;
    const isLocked = lockedUntil && lockedUntil > now;

    if (!isLocked && row && lockedUntil && lockedUntil <= now) {
      await admin.from("login_failed_attempts").delete().eq("email", email);
    }

    if (isLocked) {
      return NextResponse.json(
        { error: `Account locked. Try again after ${lockedUntil?.toLocaleTimeString()}.` },
        { status: 423 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const attemptCount = (row?.attempt_count ?? 0) + 1;
      const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);

      await admin.from("login_failed_attempts").upsert(
        {
          email,
          attempt_count: attemptCount,
          locked_until: attemptCount >= MAX_ATTEMPTS ? lockedUntil.toISOString() : null,
          updated_at: now.toISOString(),
        },
        { onConflict: "email" }
      );

      if (attemptCount >= MAX_ATTEMPTS) {
        await sendLoginLockoutEmailToUser(email);
        await sendLoginLockoutEmailToAdmin(email);
        return NextResponse.json(
          { error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` },
          { status: 423 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (data.session) {
      await admin.from("login_failed_attempts").delete().eq("email", email);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/login]", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
