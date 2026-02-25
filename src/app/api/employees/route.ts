import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/employees - List employees */
export async function GET() {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("full_name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST /api/employees - Add employee to master database */
export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const full_name = (body.full_name as string)?.trim();
    if (!full_name) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("employees")
      .insert({
        full_name,
        ni_number: (body.ni_number as string)?.trim() || null,
        bank_account_number: (body.bank_account_number as string)?.trim() || null,
        sort_code: (body.sort_code as string)?.trim() || null,
        email_address: (body.email_address as string)?.trim() || "hasanesen@gmail.com",
        default_payment_method: body.default_payment_method || "bank_transfer",
        status: body.status || "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
