import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { parseCompanySettings, type CompanySettings } from "@/lib/company-settings";

export const dynamic = "force-dynamic";

const COMPANY_KEYS = [
  "company_name",
  "company_address",
  "signature_name",
  "studio_address",
  "email_operations",
  "email_finance",
  "email_bank_transfer",
  "bank_account_gbp",
  "bank_account_eur",
  "bank_account_usd",
  "app_name",
  "invitation_subject_prefix",
  "invitation_body_intro",
  "invitation_broadcast_channel",
  "invitation_studio_intro",
  "booking_form_title",
  "booking_form_footer",
  "ics_prodid",
  "ics_summary_prefix",
  "ics_description_broadcast",
  "invoice_pdf_payee_address",
] as const;

async function requireSetupAccess() {
  const { profile } = await requireAuth();
  if (profile.role !== "admin" && profile.role !== "operations") {
    throw new Error("Forbidden");
  }
}

export async function GET() {
  try {
    await requireSetupAccess();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", COMPANY_KEYS);
    if (error) throw error;
    const settings = parseCompanySettings(data ?? []);
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireSetupAccess();
    const body = (await request.json()) as Partial<CompanySettings>;
    const supabase = createAdminClient();
    for (const key of COMPANY_KEYS) {
      const v = body[key];
      if (v !== undefined && typeof v === "string") {
        await supabase
          .from("app_settings")
          .upsert(
            { key, value: v.trim(), updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
      }
    }
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", COMPANY_KEYS);
    const settings = parseCompanySettings(data ?? []);
    return NextResponse.json(settings);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
