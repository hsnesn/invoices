import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    // Migration 00006: invoice_type column
    await supabase.rpc("exec_raw_sql", {
      query: `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'guest'`,
    }).catch(() => null);

    // We'll create tables via individual insert/select approach
    // Since we can't run DDL via PostgREST, let's check what we can do

    return NextResponse.json({ 
      message: "Please run the migration SQL files manually in Supabase SQL Editor. Go to: https://supabase.com/dashboard/project/sdkihhmxwhqwmxhzmcpp/sql/new" 
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
