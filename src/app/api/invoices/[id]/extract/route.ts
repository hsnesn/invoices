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
    const rl = checkRateLimit(request.headers);
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
      .select("storage_path, submitter_user_id")
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

    const canAccess =
      invoice.submitter_user_id === session.user.id ||
      profile?.role === "admin" ||
      profile?.role === "manager";

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await runInvoiceExtraction(invoiceId, session.user.id);

    return NextResponse.json({
      success: true,
      needs_review: result.needs_review,
      warning: result.warning,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
