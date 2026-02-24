import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
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
] as const;

export async function GET() {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = createAdminClient();
    const { data: templates } = await supabase
      .from("email_templates")
      .select("template_key, subject_template, body_template, variables");
    const { data: stages } = await supabase
      .from("email_stage_settings")
      .select("stage_key, enabled")
      .in("stage_key", EMAIL_STAGE_KEYS);

    const templateMap = Object.fromEntries(
      (templates ?? []).map((t) => [t.template_key, t])
    );
    const stageMap = Object.fromEntries(
      (stages ?? []).map((s) => [s.stage_key, s.enabled])
    );

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
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as {
      templates?: { template_key: string; subject_template?: string | null; body_template?: string | null }[];
      stages?: { stage_key: string; enabled: boolean }[];
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

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
