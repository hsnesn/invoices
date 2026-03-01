/**
 * Generate and download bank transfer form (Word docx) for international invoices.
 * When payment is international (IBAN/SWIFT), fills the Türkiye İş Bankası form
 * and returns it as a downloadable file. Also adds the form to invoice_files.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { canAccessInvoice } from "@/lib/invoice-access";
import { generateBankTransferForm } from "@/lib/bank-transfer-form";

const BUCKET = "invoices";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, submitter_user_id, invoice_type, service_description, service_date_from, service_date_to, currency")
      .eq("id", invoiceId)
      .single();

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const allowed = await canAccessInvoice(supabase, invoiceId, session.user.id, {
      role: profile.role,
      department_id: profile.department_id,
      program_ids: profile.program_ids,
      full_name: profile.full_name ?? null,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: ext } = await supabase
      .from("invoice_extracted_fields")
      .select("beneficiary_name, account_number, sort_code, gross_amount, extracted_currency, raw_json")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    const raw = (ext?.raw_json ?? {}) as Record<string, unknown>;
    const bankType = (raw.bank_type as string) ?? null;
    const isInternational = bankType === "international";

    if (!isInternational) {
      return NextResponse.json(
        { error: "Bank transfer form is only for international (IBAN/SWIFT) invoices" },
        { status: 400 }
      );
    }

    const currency = (ext?.extracted_currency ?? invoice.currency ?? "GBP") as "USD" | "EUR" | "GBP";
    const validCurrency = ["USD", "EUR", "GBP"].includes(currency) ? currency : "GBP";

    const beneficiaryName = ext?.beneficiary_name ?? "";
    const iban = (raw.iban as string) ?? ext?.account_number ?? "";
    const swiftBic = (raw.swift_bic as string) ?? ext?.sort_code ?? "";
    const bankName = (raw.bank_name as string) ?? "";
    const bankAddress = (raw.bank_address as string) ?? "";
    const amount = ext?.gross_amount ?? 0;

    if (!iban || !swiftBic) {
      return NextResponse.json(
        { error: "IBAN and SWIFT/BIC are required for bank transfer form" },
        { status: 400 }
      );
    }

    const meta = parseServiceDescription(invoice.service_description);
    const invNumber = meta.invoice_number ?? meta["invoice number"] ?? invoiceId.slice(0, 8);
    const guestName = meta.guest_name ?? meta["guest name"] ?? beneficiaryName || "Guest";
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeGuestName = guestName.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) || "Guest";
    const formFileName = `${validCurrency}-TRTW-${safeGuestName}-${invNumber}-${dateStr}.docx`;

    const formData = {
      date: dateStr,
      beneficiaryName: beneficiaryName || "—",
      iban,
      currency: validCurrency,
      bankSortCode: "", // For international, sort code is often N/A
      swiftBic,
      bankName: bankName || "",
      bankAddress: bankAddress || "",
      amount: amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      message: `Invoice ${invNumber}`,
    };

    const docxBuffer = generateBankTransferForm(formData, validCurrency);

    // Upload to storage and add to invoice_files
    const storagePath = `${session.user.id}/${invoiceId}-bank-form-${Date.now()}.docx`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, docxBuffer, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });

    if (!uploadError) {
      const { data: existingFiles } = await supabase
        .from("invoice_files")
        .select("sort_order")
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: false });
      const nextOrder = (existingFiles?.[0]?.sort_order ?? 0) + 1;

      await supabase.from("invoice_files").insert({
        invoice_id: invoiceId,
        storage_path: storagePath,
        file_name: formFileName,
        sort_order: nextOrder,
      });
    }

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${formFileName}"`,
      },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    console.error("[bank-transfer-form]", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

function parseServiceDescription(desc: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!desc) return result;
  for (const line of desc.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase();
      result[key] = line.slice(idx + 1).trim();
    }
  }
  return result;
}
