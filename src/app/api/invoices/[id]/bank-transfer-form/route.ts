/**
 * Generate and download bank transfer form (Word docx) for international invoices only.
 * Türkiye İş Bankası London Branch transfer form.
 * Block if bank_type != "international" or currency not in [USD,EUR,GBP].
 * Idempotent: returns existing file unless force=true.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { generateBankTransferForm, ACCOUNT_BY_CURRENCY } from "@/lib/bank-transfer-form";
import { createAuditEvent } from "@/lib/audit";

const BUCKET = "invoices";
const STORAGE_PREFIX = "bank-transfer";
const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP"] as const;
const WARNING_INCOMPLETE = "WARNING: MISSING BANK DETAILS – VERIFY BEFORE PAYMENT";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    // Finance user + department check (admin/operations bypass)
    const isFinanceOrHigher = ["admin", "operations", "finance"].includes(profile.role ?? "");
    if (!isFinanceOrHigher) {
      return NextResponse.json({ error: "Finance access required" }, { status: 403 });
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, submitter_user_id, department_id, service_description, currency, bank_transfer_form_path, bank_transfer_currency")
      .eq("id", invoiceId)
      .single();

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (profile.role === "finance" && invoice.department_id && profile.department_id !== invoice.department_id) {
      return NextResponse.json({ error: "Invoice does not belong to your department" }, { status: 403 });
    }

    // Idempotency: return existing file if present and not forcing
    const existingPath = (invoice as { bank_transfer_form_path?: string | null }).bank_transfer_form_path;
    if (existingPath && !force) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(existingPath);

      if (!downloadError && fileData) {
        const buf = Buffer.from(await fileData.arrayBuffer());
        const { data: inv } = await supabase
          .from("invoices")
          .select("bank_transfer_form_status, bank_transfer_currency, currency")
          .eq("id", invoiceId)
          .single();
        const invRow = inv as { bank_transfer_form_status?: string; bank_transfer_currency?: string; currency?: string } | null;
        const formStatus = invRow?.bank_transfer_form_status ?? "READY";
        const currencyFinal = invRow?.bank_transfer_currency ?? invRow?.currency ?? "";
        const senderAccount = currencyFinal && SUPPORTED_CURRENCIES.includes(currencyFinal as (typeof SUPPORTED_CURRENCIES)[number])
          ? ACCOUNT_BY_CURRENCY[currencyFinal as (typeof SUPPORTED_CURRENCIES)[number]]
          : "";

        return new NextResponse(new Uint8Array(buf), {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="bank-transfer-form.docx"`,
            "X-Form-Status": formStatus,
            "X-Sender-Account-Number": senderAccount,
            "X-Currency-Final": currencyFinal,
          },
        });
      }
    }

    const { data: ext } = await supabase
      .from("invoice_extracted_fields")
      .select("beneficiary_name, account_number, gross_amount, extracted_currency, raw_json")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    const raw = (ext?.raw_json ?? {}) as Record<string, unknown>;
    const bankType = (raw.bank_type as string) ?? null;

    if (bankType !== "international") {
      return NextResponse.json(
        { error: "Bank transfer form is only for international (IBAN/SWIFT) invoices" },
        { status: 400 }
      );
    }

    const currencyFinal = (ext?.extracted_currency ?? invoice.currency ?? "")
      .toString()
      .trim()
      .toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currencyFinal as (typeof SUPPORTED_CURRENCIES)[number])) {
      return NextResponse.json(
        { error: `Currency must be one of USD, EUR, GBP. Got: ${currencyFinal || "(empty)"}` },
        { status: 400 }
      );
    }
    const validCurrency = currencyFinal as (typeof SUPPORTED_CURRENCIES)[number];
    const senderAccount = ACCOUNT_BY_CURRENCY[validCurrency];

    const parsed = parseServiceDescription(invoice.service_description);
    const parsedInvoiceNumber = parsed.invoice_number ?? null;
    const parsedGuestName = parsed.guest_name ?? null;

    // Strict field mapping (source of truth order)
    const beneficiaryName =
      (ext?.beneficiary_name as string)?.trim() || parsedGuestName || "—";
    const iban =
      (raw.iban as string)?.trim() || (ext?.account_number as string)?.trim() || "—";
    const swiftBic = (raw.swift_bic as string)?.trim() || "—";
    const bankName = (raw.bank_name as string)?.trim() || "";
    const bankAddress = (raw.bank_address as string)?.trim() || "";
    const beneficiaryAddress = (raw.beneficiary_address as string)?.trim() || "";

    const isComplete = !!(raw.iban && raw.swift_bic);
    const formStatus = isComplete ? "READY" : "INCOMPLETE";
    const warningLine = formStatus === "INCOMPLETE" ? WARNING_INCOMPLETE : "";

    const amount = ext?.gross_amount ?? 0;
    const message = parsedInvoiceNumber ? `Invoice ${parsedInvoiceNumber}` : "Invoice";
    const dateStr = formatDateDDMMYYYY(new Date());

    const formData = {
      date: dateStr,
      sender_account_number: senderAccount,
      beneficiary_name: beneficiaryName,
      iban,
      swift_bic: swiftBic,
      bank_name: bankName,
      bank_address: bankAddress,
      beneficiary_address: beneficiaryAddress,
      amount: amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      currency: validCurrency,
      message,
      bank_sort_code: "",
      warning_line: warningLine,
      charges: "",
      daytime_phone: "",
    };

    const docxBuffer = generateBankTransferForm(formData);

    const storagePath = `${STORAGE_PREFIX}/${invoiceId}/bank-transfer-form.docx`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, docxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      console.error("[bank-transfer-form] Storage upload failed:", uploadError.message);
      return NextResponse.json({ error: "Failed to save bank transfer form" }, { status: 500 });
    }

    await supabase
      .from("invoices")
      .update({
        bank_transfer_form_path: storagePath,
        bank_transfer_form_status: formStatus,
        bank_transfer_currency: validCurrency,
        bank_transfer_generated_at: new Date().toISOString(),
        bank_transfer_generated_by: session.user.id,
      })
      .eq("id", invoiceId);

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "generate_bank_transfer_form",
      payload: {
        form_status: formStatus,
        currency_final: validCurrency,
        sender_account_number: senderAccount,
        generated_by: session.user.id,
        timestamp: new Date().toISOString(),
      },
    });

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="bank-transfer-form.docx"`,
        "X-Form-Status": formStatus,
        "X-Sender-Account-Number": senderAccount,
        "X-Currency-Final": validCurrency,
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

function formatDateDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const INVOICE_NUMBER_KEYS = [
  "invoice_number",
  "invoice number",
  "inv_number",
  "invoice no",
  "invoice #",
  "inv no",
];
const GUEST_NAME_KEYS = ["guest_name", "guest name", "guest", "name"];

function toSnakeCase(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function parseServiceDescription(desc: string | null): {
  invoice_number?: string;
  guest_name?: string;
  [key: string]: string | undefined;
} {
  const result: Record<string, string> = {};
  if (!desc) return result;
  for (const line of desc.split("\n")) {
    const sepIdx = Math.min(
      line.indexOf(":") >= 0 ? line.indexOf(":") : Infinity,
      line.indexOf("=") >= 0 ? line.indexOf("=") : Infinity
    );
    if (sepIdx > 0) {
      const keyRaw = line.slice(0, sepIdx).trim();
      const value = line.slice(sepIdx + 1).trim();
      const key = toSnakeCase(keyRaw);
      result[key] = value;
    }
  }
  const out: Record<string, string | undefined> = { ...result };
  for (const k of INVOICE_NUMBER_KEYS) {
    const key = toSnakeCase(k);
    const v = result[key];
    if (v) {
      out.invoice_number = v;
      break;
    }
  }
  for (const k of GUEST_NAME_KEYS) {
    const key = toSnakeCase(k);
    const v = result[key];
    if (v) {
      out.guest_name = v;
      break;
    }
  }
  return out;
}
