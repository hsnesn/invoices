import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const canAccess =
      profile.role === "admin" ||
      (Array.isArray(profile.allowed_pages) && (profile.allowed_pages as PageKey[]).includes("guest_contacts"));
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = (await request.json()) as {
      guest_names?: string[];
      contacts?: { guest_name: string; email?: string | null }[];
      subject?: string;
      message?: string;
    };

    const subject = body.subject?.trim();
    const message = body.message?.trim();
    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const contacts = body.contacts ?? [];
    const emails = contacts
      .map((c) => c.email?.trim())
      .filter((e): e is string => !!e && e.includes("@"));

    const uniqueEmails = Array.from(new Set(emails));
    if (uniqueEmails.length === 0) {
      return NextResponse.json({ error: "No valid email addresses in selected contacts" }, { status: 400 });
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;line-height:1.6;color:#333">
<div style="max-width:600px;margin:0 auto;padding:20px">
<p style="white-space:pre-wrap">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
</div></body></html>`;

    const result = await sendEmail({ to: uniqueEmails, subject, html });

    if (result.success) {
      return NextResponse.json({
        message: `Email sent to ${uniqueEmails.length} recipient(s).`,
        count: uniqueEmails.length,
      });
    }
    return NextResponse.json({ error: result.error ?? "Failed to send email" }, { status: 500 });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
