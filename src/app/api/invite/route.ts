import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";
import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Invoice Approval Workflow";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${APP_NAME} <noreply@example.com>`;

function invitationEmailHtml(inviterName: string, recipientName: string, role: string, magicLink: string) {
  const roleBadgeColor = { admin: "#dc2626", manager: "#2563eb", finance: "#059669", submitter: "#6b7280" }[role] ?? "#6b7280";
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:32px 32px 28px;text-align:center">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">${APP_NAME}</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#94a3b8">You've been invited to join</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6">
        Hi${recipientName ? ` <strong>${recipientName}</strong>` : ""},
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6">
        <strong>${inviterName}</strong> has invited you to join <strong>${APP_NAME}</strong> as:
      </p>
      <div style="text-align:center;margin:0 0 24px">
        <span style="display:inline-block;background:${roleBadgeColor};color:#fff;padding:6px 20px;border-radius:24px;font-size:13px;font-weight:600;text-transform:capitalize">${role}</span>
      </div>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6">
        Click the button below to accept the invitation and set your password. This link will expire in 24 hours.
      </p>
      <div style="text-align:center;margin:0 0 24px">
        <a href="${magicLink}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;box-shadow:0 2px 8px rgba(37,99,235,0.3)">Accept Invitation</a>
      </div>
      <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.5">
        If the button doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="margin:0 0 24px;font-size:11px;color:#2563eb;word-break:break-all;line-height:1.4">${magicLink}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;text-align:center">
        If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>
  </div>
</body></html>`;
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAdmin();
    const body = await request.json();
    const { email, full_name, role, department_id, program_ids } = body as {
      email: string; full_name?: string; role: "submitter" | "manager" | "admin" | "finance";
      department_id?: string | null; program_ids?: string[] | null;
    };

    if (!email || !role) return NextResponse.json({ error: "email and role are required" }, { status: 400 });
    if (!["submitter", "manager", "admin", "finance"].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const supabase = createAdminClient();
    const { data: existing } = await supabase.from("user_invitations").select("accepted").eq("email", email.toLowerCase().trim()).single();
    if (existing?.accepted) return NextResponse.json({ error: "User has already accepted this invitation" }, { status: 400 });

    const { data: inv, error: invError } = await supabase.from("user_invitations").upsert({
      email: email.toLowerCase().trim(), full_name: full_name ?? null, role,
      department_id: department_id ?? null, program_ids: program_ids ?? [],
      invited_by: profile.id, accepted: false,
    }, { onConflict: "email" }).select().single();

    if (invError) return NextResponse.json({ error: invError.message }, { status: 500 });

    // Use hashed_token to build our own callback URL (Supabase action_link redirect can fail)
    const emailNorm = email.toLowerCase().trim();
    const nextPath = "/auth/accept-invite";
    let magicLink: string | undefined;

    for (const { type, linkType } of [{ type: "invite" as const, linkType: "invite" }, { type: "magiclink" as const, linkType: "magiclink" }]) {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type, email: emailNorm,
        options: { redirectTo: `${APP_URL}/auth/callback` },
      });
      const hash = linkData?.properties?.hashed_token;
      if (hash) {
        magicLink = `${APP_URL}/auth/callback?token_hash=${encodeURIComponent(hash)}&next=${encodeURIComponent(nextPath)}`;
        break;
      }
      if (linkError && type === "invite") {
        console.warn("invite link failed, trying magiclink:", linkError.message);
      }
    }

    if (!magicLink) return NextResponse.json({ error: "Failed to generate invitation link" }, { status: 500 });

    const resend = getResend();
    if (!resend) return NextResponse.json({ error: "Email not configured. Set RESEND_API_KEY in environment variables." }, { status: 500 });

    const inviterName = profile.full_name || "An administrator";
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: FROM_EMAIL, to: email,
      subject: `You're invited to ${APP_NAME}`,
      html: invitationEmailHtml(inviterName, full_name || "", role, magicLink),
    });

    if (emailError) {
      console.error("Resend invite error:", emailError);
      return NextResponse.json({ error: `Email failed: ${emailError.message}` }, { status: 500 });
    }

    await createAuditEvent({ actor_user_id: profile.id, event_type: "user_invited", payload: { email, role, invitation_id: inv.id, resend_id: emailData?.id } });
    return NextResponse.json({ success: true, invitation: inv, resend_id: emailData?.id });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase.from("user_invitations").delete().eq("email", email.toLowerCase().trim()).eq("accepted", false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { profile } = await requireAdmin();
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const supabase = createAdminClient();
    const emailNorm = email.toLowerCase().trim();
    const { data: inv } = await supabase.from("user_invitations").select("*").eq("email", emailNorm).eq("accepted", false).single();
    if (!inv) return NextResponse.json({ error: "Invitation not found or already accepted" }, { status: 404 });

    const nextPath = "/auth/accept-invite";
    let magicLink: string | undefined;
    for (const type of ["invite", "magiclink"] as const) {
      const { data } = await supabase.auth.admin.generateLink({
        type, email: emailNorm,
        options: { redirectTo: `${APP_URL}/auth/callback` },
      });
      const hash = data?.properties?.hashed_token;
      if (hash) {
        magicLink = `${APP_URL}/auth/callback?token_hash=${encodeURIComponent(hash)}&next=${encodeURIComponent(nextPath)}`;
        break;
      }
    }
    if (!magicLink) return NextResponse.json({ error: "Failed to generate invitation link" }, { status: 500 });

    const resend = getResend();
    if (!resend) return NextResponse.json({ error: "Email not configured. Set RESEND_API_KEY in environment variables." }, { status: 500 });

    const inviterName = profile.full_name || "An administrator";
    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL, to: email,
      subject: `Reminder: You're invited to ${APP_NAME}`,
      html: invitationEmailHtml(inviterName, inv.full_name || "", inv.role, magicLink),
    });

    if (emailError) {
      console.error("Resend resend-invite error:", emailError);
      return NextResponse.json({ error: `Email failed: ${emailError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
