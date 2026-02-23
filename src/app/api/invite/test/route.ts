import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { Resend } from "resend";

/**
 * Send a test email to verify Resend configuration.
 * GET /api/invite/test?email=your@email.com
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ error: "Add ?email=your@email.com" }, { status: 400 });

    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "Clari Invoice <noreply@clari.uk>";
    if (!key) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: from,
      to: email,
      subject: "Test email — Clari Invoice",
      html: `
        <p>This is a test email from your Clari Invoice system.</p>
        <p>If you received this, Resend is configured correctly.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data?.id });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
