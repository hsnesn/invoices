import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrOperations } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_STAGE_KEYS } from "@/lib/email-settings";

const TEMPLATE_KEYS = [
  "submission",
  "manager_approved",
  "manager_rejected",
  "ready_for_payment",
  "paid",
  "manager_assigned",
  "resubmitted",
  "admin_approved",
  "guest_link_sent",
  "guest_invoice_submitted",
  "availability_submitted",
  "availability_cleared",
  "assignment_confirmed",
  "assignment_reminder",
  "booking_form_approved",
  "office_request_approved",
  "office_request_assigned",
  "office_request_rejected",
] as const;

const RECIPIENT_TYPES = [
  "submitter",
  "dept_ep",
  "admin",
  "finance",
  "operations",
  "producers",
  "guest",
  "producer",
  "contractor",
  "line_manager",
  "assignee",
  "requester",
] as const;

export async function GET() {
  try {
    await requireAdminOrOperations();
    const supabase = createAdminClient();
    const { data: templates } = await supabase
      .from("email_templates")
      .select("template_key, subject_template, body_template, variables");
    const { data: stages } = await supabase
      .from("email_stage_settings")
      .select("stage_key, enabled")
      .in("stage_key", EMAIL_STAGE_KEYS);
    let recipients: { stage_key: string; recipient_type: string; enabled: boolean }[] | null = null;
    try {
      const res = await supabase.from("email_recipient_settings").select("stage_key, recipient_type, enabled");
      recipients = res.data;
    } catch {
      /* Table may not exist yet */
    }

    const templateMap = Object.fromEntries(
      (templates ?? []).map((t) => [t.template_key, t])
    );
    const stageMap = Object.fromEntries(
      (stages ?? []).map((s) => [s.stage_key, s.enabled])
    );
    const recipientMap = new Map<string, boolean>();
    for (const r of recipients ?? []) {
      recipientMap.set(`${r.stage_key}:${r.recipient_type}`, r.enabled);
    }

    return NextResponse.json({
      templates: TEMPLATE_KEYS.map((key) => ({
        template_key: key,
        subject_template: templateMap[key]?.subject_template ?? null,
        body_template: templateMap[key]?.body_template ?? null,
        variables: templateMap[key]?.variables ?? [],
      })),
      stages: EMAIL_STAGE_KEYS.map((key) => ({
        stage_key: key,
        enabled: stageMap[key] ?? true,
      })),
      recipients: (recipients ?? []).map((r) => ({
        stage_key: r.stage_key,
        recipient_type: r.recipient_type,
        enabled: r.enabled,
      })),
      recipientMap: Object.fromEntries(recipientMap),
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminOrOperations();
    const body = (await request.json()) as {
      templates?: { template_key: string; subject_template?: string | null; body_template?: string | null }[];
      stages?: { stage_key: string; enabled: boolean }[];
      recipients?: { stage_key: string; recipient_type: string; enabled: boolean }[];
    };

    const supabase = createAdminClient();

    if (body.templates) {
      for (const t of body.templates) {
        if (!TEMPLATE_KEYS.includes(t.template_key as (typeof TEMPLATE_KEYS)[number])) continue;
        await supabase.from("email_templates").upsert(
          {
            template_key: t.template_key,
            subject_template: t.subject_template ?? null,
            body_template: t.body_template ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "template_key" }
        );
      }
    }

    if (body.stages) {
      for (const s of body.stages) {
        if (!EMAIL_STAGE_KEYS.includes(s.stage_key as (typeof EMAIL_STAGE_KEYS)[number])) continue;
        await supabase.from("email_stage_settings").upsert(
          {
            stage_key: s.stage_key,
            enabled: s.enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stage_key" }
        );
      }
    }

    if (body.recipients) {
      try {
        for (const r of body.recipients) {
          if (!EMAIL_STAGE_KEYS.includes(r.stage_key as (typeof EMAIL_STAGE_KEYS)[number])) continue;
          if (!RECIPIENT_TYPES.includes(r.recipient_type as (typeof RECIPIENT_TYPES)[number])) continue;
          await supabase.from("email_recipient_settings").upsert(
            {
              stage_key: r.stage_key,
              recipient_type: r.recipient_type,
              enabled: r.enabled,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "stage_key,recipient_type" }
          );
        }
      } catch {
        /* Table may not exist */
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
