import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";
import { sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInviteIcs } from "@/lib/ics-generator";
import { getProgramDescription } from "@/lib/program-descriptions";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

function escapeHtml(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

function buildInviteHtml(params: {
  guestName: string;
  producerName: string;
  programName: string;
  topic: string;
  recordDate: string;
  recordTime: string;
  format: "remote" | "studio";
  studioAddress: string;
  programDescription?: string | null;
  customGreeting?: string | null;
}): string {
  const greeting = params.customGreeting?.trim() || politeGreeting(params.guestName);
  const safe = {
    greeting: escapeHtml(greeting),
    producerName: escapeHtml(params.producerName),
    programName: escapeHtml(params.programName),
    topic: escapeHtml(params.topic),
    recordDate: escapeHtml(params.recordDate),
    recordTime: escapeHtml(params.recordTime),
    studioAddress: escapeHtml(params.studioAddress),
    programDescription: params.programDescription ? escapeHtml(params.programDescription) : null,
  };
  const formatText =
    params.format === "remote"
      ? "The recording will be conducted remotely via Skype or Zoom."
      : `The recording will take place in our studio. The address is: ${safe.studioAddress || "—"}`;
  const progDescBlock = safe.programDescription
    ? `<p><em>${safe.programDescription}</em></p>`
    : "";
  const pickupBlock =
    params.format === "studio"
      ? "<p>We can arrange to pick you up from your preferred location and drop you back after the recording.</p>"
      : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;line-height:1.6;color:#333">
<div style="max-width:600px;margin:0 auto;padding:20px">
<p>${safe.greeting},</p>
<p>I hope this message finds you well.</p>
<p>I am writing to invite you to participate in <strong>${safe.programName}</strong>, which will be broadcast on TRT World and will focus on ${safe.topic}.</p>
${progDescBlock}
<p>The recording is scheduled for <strong>${safe.recordDate}</strong> at <strong>${safe.recordTime}</strong>.</p>
<p>${formatText}</p>
${pickupBlock}
<p>Would you be interested in joining us for this program? Please reply to this email to confirm your participation.</p>
<p>Best regards,<br/>${safe.producerName}</p>
</div></body></html>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
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
      producer_user_id?: string;
      program_name?: string;
      topic?: string;
      record_date?: string;
      record_time?: string;
      format?: "remote" | "studio";
      studio_address?: string;
      include_program_description?: boolean;
      attach_calendar?: boolean;
      bcc_producer?: boolean;
      custom_greetings?: Record<string, string>;
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
      const producerUserId = body.producer_user_id?.trim();
      const programName = body.program_name?.trim() || "our program";
      const topic = body.topic?.trim() || "the scheduled topic";
      const recordDate = body.record_date?.trim();
      const recordTime = body.record_time?.trim();
      if (!recordDate || !recordTime || recordDate === "TBD" || recordTime === "TBD") {
        return NextResponse.json({ error: "Recording date and time are required" }, { status: 400 });
      }
      const format = body.format === "studio" ? "studio" : "remote";
      const studioAddress = body.studio_address?.trim() || "";
      const includeProgramDescription = !!body.include_program_description;
      const attachCalendar = body.attach_calendar !== false;
      const bccProducer = body.bcc_producer !== false && !!producerEmail;
      const customGreetings = body.custom_greetings ?? {};

      const programDescription = includeProgramDescription ? getProgramDescription(programName) : null;

      const subjectBase = `TRT World – Invitation to the program: ${programName}`;
      const supabase = createAdminClient();
      let sent = 0;

      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        const html = buildInviteHtml({
          guestName: c.guest_name || "Guest",
          producerName,
          programName,
          topic,
          recordDate,
          recordTime,
          format,
          studioAddress,
          programDescription,
          customGreeting: customGreetings[c.guest_name],
        });

        const attachments: { filename: string; content: Buffer | string }[] = [];
        if (attachCalendar) {
          const ics = generateInviteIcs({ programName, topic, recordDate, recordTime, studioAddress: format === "studio" ? studioAddress : undefined });
          attachments.push({ filename: "invitation.ics", content: ics });
        }

        const result = await sendEmail({
          to: c.email!,
          subject: subjectBase,
          html,
          replyTo: producerEmail || undefined,
          bcc: bccProducer ? [producerEmail!] : undefined,
          attachments: attachments.length ? attachments : undefined,
        });

        if (result.success) {
          sent++;
          const now = new Date().toISOString();
          const guestName = c.guest_name || "Guest";
          const guestEmail = c.email!;

          const nameNorm = guestName.toLowerCase().trim().replace(/\s+/g, " ");
          const { data: existing } = await supabase
            .from("guest_contacts")
            .select("id")
            .eq("guest_name_key", nameNorm)
            .maybeSingle();

          const updateData = {
            email: guestEmail,
            topic: topic,
            primary_program: programName,
            last_invited_at: now,
            updated_at: now,
            source: "invitation",
          };

          let contactId: string | null = existing?.id ?? null;
          if (existing?.id) {
            await supabase.from("guest_contacts").update(updateData).eq("id", existing.id);
          } else {
            const { data: inserted } = await supabase
              .from("guest_contacts")
              .insert({ guest_name: guestName, ...updateData })
              .select("id")
              .single();
            contactId = inserted?.id ?? null;
          }

          await supabase.from("guest_invitations").insert({
            guest_name: guestName,
            guest_email: guestEmail,
            guest_contact_id: contactId,
            program_name: programName,
            topic,
            record_date: recordDate,
            record_time: recordTime,
            format,
            studio_address: format === "studio" ? studioAddress : null,
            producer_user_id: producerUserId || null,
            producer_name: producerName,
            producer_email: producerEmail || null,
            sent_at: now,
          });
        }

        if (i < contacts.length - 1 && (i + 1) % BATCH_SIZE === 0) {
          await sleep(BATCH_DELAY_MS);
        }
      }

      return NextResponse.json({
        message: `Invitation sent to ${sent} recipient(s). Guests saved to contact list.`,
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
