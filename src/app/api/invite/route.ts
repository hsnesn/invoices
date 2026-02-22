import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAdmin();

    const body = await request.json();
    const {
      email,
      full_name,
      role,
      department_id,
      program_ids,
    }: {
      email: string;
      full_name?: string;
      role: "submitter" | "manager" | "admin" | "finance";
      department_id?: string | null;
      program_ids?: string[] | null;
    } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: "email and role are required" },
        { status: 400 }
      );
    }

    const validRoles = ["submitter", "manager", "admin", "finance"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("user_invitations")
      .select("accepted")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existing?.accepted) {
      return NextResponse.json(
        { error: "User has already accepted this invitation" },
        { status: 400 }
      );
    }

    // Upsert invitation
    const { data: inv, error: invError } = await supabase
      .from("user_invitations")
      .upsert(
        {
          email: email.toLowerCase().trim(),
          full_name: full_name ?? null,
          role,
          department_id: department_id ?? null,
          program_ids: program_ids ?? [],
          invited_by: profile.id,
          accepted: false,
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }

    // Send invite link (password setup flow)
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: "invite",
      email: email.toLowerCase().trim(),
      options: { redirectTo: `${APP_URL}/auth/reset-password` },
    });

    const magicLink = linkData?.properties?.action_link;
    if (magicLink && process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "Invoice System <noreply@example.com>",
        to: email,
        subject: `You're invited to ${process.env.NEXT_PUBLIC_APP_NAME ?? "Invoice Approval Workflow"}`,
        html: `
          <p>You have been invited to join. Click the link below to accept and set your password:</p>
          <p><a href="${magicLink}">Accept invitation</a></p>
          <p>If you did not expect this invitation, you can ignore this email.</p>
        `,
      });
    }

    await createAuditEvent({
      actor_user_id: profile.id,
      event_type: "user_invited",
      payload: { email, role, invitation_id: inv.id },
    });

    return NextResponse.json({ success: true, invitation: inv });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
