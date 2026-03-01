import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = await checkRateLimit(request);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }
    const { session } = await requireAuth();
    const { id: invoiceId } = await params;

    const supabase = createAdminClient();
    const { data: invoice } = await supabase
      .from("invoices")
      .select("storage_path, submitter_user_id, invoice_type")
      .eq("id", invoiceId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const profile = await (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      return data;
    })();

    const invType = (invoice as { invoice_type?: string }).invoice_type;
    const canAccess =
      invoice.submitter_user_id === session.user.id ||
      profile?.role === "admin" ||
      profile?.role === "manager" ||
      (invType === "other" && (profile?.role === "finance" || profile?.role === "operations"));

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { fields?: string[] } = {};
    try {
      body = (await request.json().catch(() => ({}))) as { fields?: string[] };
    } catch { /* */ }
    const targetFields = Array.isArray(body.fields) ? body.fields.filter((f): f is string => typeof f === "string") : undefined;

    const result = await runInvoiceExtraction(invoiceId, session.user.id, { fields: targetFields });

    return NextResponse.json({
      success: true,
      needs_review: result.needs_review,
      warning: result.warning,
      extracted: (result as { extracted?: Record<string, string | number | null> }).extracted,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
