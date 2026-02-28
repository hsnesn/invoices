/**
 * Send invite from producer guests flow.
 * Saves to producer_guests (invited_at), guest_contacts, guest_invitations.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { generateInviteIcs } from "@/lib/ics-generator";
import { getProgramDescription } from "@/lib/program-descriptions";
import { buildInviteGreeting, type GreetingType } from "@/lib/invite-greeting";

function escapeHtml(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  greetingType?: GreetingType;
}): string {
  const greeting = buildInviteGreeting(params.guestName, params.greetingType ?? "dear");
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
  const progDescBlock = safe.programDescription ? `<p><em>${safe.programDescription}</em></p>` : "";
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

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    const body = (await request.json()) as {
      producer_guest_id?: string;
      guest_name: string;
      email: string;
      title: string;
      program_name: string;
      topic: string;
      record_date: string;
      record_time: string;
      format: "remote" | "studio";
      studio_address: string;
      producer_name: string;
      producer_email: string;
      producer_user_id: string;
      include_program_description?: boolean;
      attach_calendar?: boolean;
      bcc_producer?: boolean;
      greeting_type?: "dear" | "mr_ms" | "mr" | "ms" | "mrs" | "miss";
    };

    const guestName = body.guest_name?.trim();
    const email = body.email?.trim();
    const title = body.title?.trim();
    if (!guestName || !email || !email.includes("@")) {
      return NextResponse.json({ error: "Guest name and valid email are required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required before sending" }, { status: 400 });
    }

    const recordDate = body.record_date?.trim();
    const recordTime = body.record_time?.trim();
    if (!recordDate || !recordTime || recordDate === "TBD" || recordTime === "TBD") {
      return NextResponse.json({ error: "Recording date and time are required" }, { status: 400 });
    }

    const producerName = body.producer_name?.trim() || "The Producer";
    const producerEmail = body.producer_email?.trim();
    const programName = body.program_name?.trim() || "our program";
    const topic = body.topic?.trim() || "the scheduled topic";
    const format = body.format === "studio" ? "studio" : "remote";
    const studioAddress = body.studio_address?.trim() || "";
    const includeProgramDescription = !!body.include_program_description;
    const attachCalendar = body.attach_calendar !== false;
    const bccProducer = body.bcc_producer !== false && !!producerEmail;

    const programDescription = includeProgramDescription ? getProgramDescription(programName) : null;
    const valid: GreetingType[] = ["dear", "mr_ms", "mr", "ms", "mrs", "miss"];
    const greetingType = valid.includes(body.greeting_type as GreetingType) ? (body.greeting_type as GreetingType) : "dear";

    const subjectBase = `TRT World – Invitation to the program: ${programName}`;
    const html = buildInviteHtml({
      guestName,
      producerName,
      programName,
      topic,
      recordDate,
      recordTime,
      format,
      studioAddress,
      programDescription,
      greetingType,
    });

    const attachments: { filename: string; content: Buffer | string }[] = [];
    if (attachCalendar) {
      const ics = generateInviteIcs({ programName, topic, recordDate, recordTime, studioAddress: format === "studio" ? studioAddress : undefined });
      attachments.push({ filename: "invitation.ics", content: ics });
    }

    const result = await sendEmail({
      to: email,
      subject: subjectBase,
      html,
      replyTo: producerEmail || undefined,
      bcc: bccProducer ? [producerEmail!] : undefined,
      fromName: producerName,
      fromEmail: producerEmail || undefined,
      attachments: attachments.length ? attachments : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to send email" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const guestNameNorm = guestName.trim().replace(/\s+/g, " ");
    const nameNorm = guestNameNorm.toLowerCase();

    const { data: existingGc } = await supabase.from("guest_contacts").select("id").eq("guest_name_key", nameNorm).maybeSingle();
    const updateData = {
      email,
      topic,
      primary_program: programName,
      title: title || undefined,
      last_invited_at: now,
      updated_at: now,
      source: "invitation",
    };
    if (existingGc?.id) {
      await supabase.from("guest_contacts").update(updateData).eq("id", existingGc.id);
    } else {
      await supabase.from("guest_contacts").insert({ guest_name: guestNameNorm, ...updateData });
    }

    const { data: gcRow } = await supabase.from("guest_contacts").select("id").eq("guest_name_key", nameNorm).maybeSingle();

    await supabase.from("guest_invitations").insert({
      guest_name: guestName,
      guest_email: email,
      guest_contact_id: gcRow?.id ?? null,
      program_name: programName,
      topic,
      record_date: recordDate,
      record_time: recordTime,
      format,
      studio_address: format === "studio" ? studioAddress : null,
      producer_user_id: body.producer_user_id || session.user.id,
      producer_name: producerName,
      producer_email: producerEmail || null,
      sent_at: now,
    });

    if (body.producer_guest_id) {
      await supabase
        .from("producer_guests")
        .update({ email, title, program_name: programName, invited_at: now, updated_at: now })
        .eq("id", body.producer_guest_id)
        .eq("producer_user_id", session.user.id);
    } else {
      await supabase.from("producer_guests").insert({
        producer_user_id: session.user.id,
        guest_name: guestName,
        email,
        title,
        program_name: programName,
        invited_at: now,
      });
    }

    return NextResponse.json({ success: true, message: "Invitation sent. Guest saved to your list and main contact list." });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
