import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";
import { sendEmail } from "@/lib/email";

function escapeHtml(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Build polite greeting from guest name (e.g. "Dear Mr. Smith" or "Dear John") */
function politeGreeting(guestName: string): string {
  const name = guestName.trim();
  if (!name) return "Dear Sir or Madam";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    return `Dear Mr./Ms. ${lastName}`;
  }
  return `Dear ${name}`;
}

/** Build guest invite template HTML for a single recipient */
function buildInviteHtml(params: {
  guestName: string;
  producerName: string;
  programName: string;
  topic: string;
  recordDate: string;
  recordTime: string;
}): string {
  const greeting = politeGreeting(params.guestName);
  const safe = {
    greeting: escapeHtml(greeting),
    producerName: escapeHtml(params.producerName),
    programName: escapeHtml(params.programName),
    topic: escapeHtml(params.topic),
    recordDate: escapeHtml(params.recordDate),
    recordTime: escapeHtml(params.recordTime),
  };
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;line-height:1.6;color:#333">
<div style="max-width:600px;margin:0 auto;padding:20px">
<p>${safe.greeting},</p>
<p>I hope this message finds you well.</p>
<p>I am writing to invite you to participate in <strong>${safe.programName}</strong>, which will focus on ${safe.topic}.</p>
<p>The recording is scheduled for <strong>${safe.recordDate}</strong> at <strong>${safe.recordTime}</strong>.</p>
<p>Would you be interested in joining us for this program? Please reply to this email to confirm your participation.</p>
<p>Best regards,<br/>${safe.producerName}</p>
</div></body></html>`;
}

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
      use_template?: boolean;
      producer_name?: string;
      producer_email?: string;
      program_name?: string;
      topic?: string;
      record_date?: string;
      record_time?: string;
      contacts?: { guest_name: string; email?: string | null }[];
      subject?: string;
      message?: string;
    };

    const contacts = (body.contacts ?? [])
      .map((c) => ({ guest_name: c.guest_name?.trim() ?? "", email: c.email?.trim() }))
      .filter((c) => c.email && c.email.includes("@"));

    if (contacts.length === 0) {
      return NextResponse.json({ error: "No valid email addresses in selected contacts" }, { status: 400 });
    }

    if (body.use_template) {
      const producerName = body.producer_name?.trim() || "The Producer";
      const producerEmail = body.producer_email?.trim();
      const programName = body.program_name?.trim() || "our program";
      const topic = body.topic?.trim() || "the scheduled topic";
      const recordDate = body.record_date?.trim() || "TBD";
      const recordTime = body.record_time?.trim() || "TBD";

      const subjectBase = `Invitation: ${programName}`;
      let sent = 0;
      for (const c of contacts) {
        const html = buildInviteHtml({
          guestName: c.guest_name || "Guest",
          producerName,
          programName,
          topic,
          recordDate,
          recordTime,
        });
        const result = await sendEmail({
          to: c.email!,
          subject: subjectBase,
          html,
          replyTo: producerEmail || undefined,
        });
        if (result.success) sent++;
      }
      return NextResponse.json({
        message: `Invitation sent to ${sent} recipient(s).`,
        count: sent,
      });
    }

    const subject = body.subject?.trim();
    const message = body.message?.trim();
    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const uniqueEmails = Array.from(new Set(contacts.map((c) => c.email!)));
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;line-height:1.6;color:#333">
<div style="max-width:600px;margin:0 auto;padding:20px">
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>
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
