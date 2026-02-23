import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

/**
 * Admin-only: Check email configuration status (no secrets exposed).
 */
export async function GET() {
  try {
    await requireAdmin();
    const hasKey = !!process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "(not set)";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "(not set)";
    return NextResponse.json({
      hasResendKey: hasKey,
      fromEmail: from,
      appUrl,
      hint: !hasKey
        ? "Set RESEND_API_KEY in Vercel Environment Variables"
        : from.includes("gmail") || from.includes("example.com")
          ? "RESEND_FROM_EMAIL must use verified domain (e.g. noreply@clari.uk)"
          : "Config looks OK. Check Resend dashboard & spam folder.",
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
