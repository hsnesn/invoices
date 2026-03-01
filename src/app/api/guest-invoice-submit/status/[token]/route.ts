/**
 * Guest invoice status check and download.
 * Public - no auth. Token from guest_invoice_status_tokens (created on submission).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "invoices";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || !UUID_RE.test(token)) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: statusRow, error: statusErr } = await supabase
      .from("guest_invoice_status_tokens")
      .select("invoice_id, guest_name, program_name, created_at")
      .eq("token", token)
      .single();

    if (statusErr || !statusRow) {
      return NextResponse.json({ error: "Status link not found" }, { status: 404 });
    }

    const createdAt = (statusRow as { created_at?: string }).created_at;
    const EXPIRY_DAYS = 7;
    if (createdAt) {
      const created = new Date(createdAt).getTime();
      const expiry = created + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() > expiry) {
        const isDownload = request.nextUrl.searchParams.get("download") === "1";
        const statusPageUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/submit/status/${token}?expired=1`;
        if (isDownload) {
          return NextResponse.redirect(statusPageUrl);
        }
        return NextResponse.json(
          { error: "This link has expired. Status and download links are valid for 7 days." },
          { status: 410 }
        );
      }
    }

    const invoiceId = (statusRow as { invoice_id: string }).invoice_id;

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("storage_path")
      .eq("id", invoiceId)
      .single();

    if (invErr || !inv) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: wf } = await supabase
      .from("invoice_workflows")
      .select("status, paid_date")
      .eq("invoice_id", invoiceId)
      .single();

    const { data: ext } = await supabase
      .from("invoice_extracted_fields")
      .select("invoice_number")
      .eq("invoice_id", invoiceId)
      .single();

    const status = (wf as { status?: string })?.status ?? "pending_manager";
    const paidDate = (wf as { paid_date?: string | null })?.paid_date;
    const invoiceNumber = (ext as { invoice_number?: string | null })?.invoice_number ?? "—";

    const statusLabel =
      paidDate != null
        ? "Paid"
        : status === "paid" || status === "archived"
          ? "Paid"
          : status === "approved_by_manager" || status === "ready_for_payment"
            ? "Approved"
            : status === "rejected"
              ? "Rejected"
              : "Processing";

    const downloadParam = request.nextUrl.searchParams.get("download");
    if (downloadParam === "1" && inv.storage_path) {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(inv.storage_path, 3600);

      if (dlErr || !fileData?.signedUrl) {
        return NextResponse.json({ error: "Download unavailable" }, { status: 500 });
      }
      return NextResponse.redirect(fileData.signedUrl);
    }

    return NextResponse.json({
      status: statusLabel,
      statusRaw: status,
      invoiceNumber,
      guestName: (statusRow as { guest_name?: string }).guest_name,
      programName: (statusRow as { program_name?: string }).program_name,
      paidDate: paidDate || null,
      downloadUrl: `/api/guest-invoice-submit/status/${token}?download=1`,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
