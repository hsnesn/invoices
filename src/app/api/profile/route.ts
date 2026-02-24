import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    let fullName = profile.full_name;
    const { data: authUser } = await supabase.auth.admin.getUserById(session.user.id);
    const email = authUser?.user?.email ?? null;
    if (!fullName) fullName = email?.split("@")[0] ?? null;

    let departmentName: string | null = null;
    if (profile.department_id) {
      const { data: dept } = await supabase.from("departments").select("name").eq("id", profile.department_id).single();
      departmentName = dept?.name ?? null;
    }

    const receiveInvoiceEmails = (profile as { receive_invoice_emails?: boolean }).receive_invoice_emails !== false;

    return NextResponse.json({
      id: profile.id,
      full_name: fullName,
      email,
      role: profile.role,
      department_id: profile.department_id,
      department_name: departmentName,
      is_active: profile.is_active,
      receive_invoice_emails: receiveInvoiceEmails,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const body = (await request.json()) as { full_name?: string; receive_invoice_emails?: boolean };

    const supabase = createAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.full_name !== undefined) {
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
      if (fullName.length > 255) {
        return NextResponse.json({ error: "Name must be at most 255 characters" }, { status: 400 });
      }
      updates.full_name = fullName || null;
    }

    if (body.receive_invoice_emails !== undefined) {
      updates.receive_invoice_emails = !!body.receive_invoice_emails;
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { error } = await supabase.from("profiles").update(updates).eq("id", session.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      full_name: updates.full_name ?? profile.full_name,
      receive_invoice_emails: updates.receive_invoice_emails ?? (profile as { receive_invoice_emails?: boolean }).receive_invoice_emails !== false,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
