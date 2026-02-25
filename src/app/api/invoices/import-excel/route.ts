import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";
import * as XLSX from "xlsx";

function buildServiceDescription(fields: {
  guest_name?: string | null;
  title?: string | null;
  producer?: string | null;
  topic?: string | null;
  invoice_date?: string | null;
  tx_date_1?: string | null;
  tx_date_2?: string | null;
  tx_date_3?: string | null;
  payment_type?: string | null;
}) {
  return [
    `Guest Name: ${fields.guest_name ?? ""}`,
    `Title: ${fields.title ?? ""}`,
    `Producer: ${fields.producer ?? ""}`,
    `Topic: ${fields.topic ?? ""}`,
    `Invoice Date: ${fields.invoice_date ?? ""}`,
    `TX Date: ${fields.tx_date_1 ?? ""}`,
    fields.tx_date_2 ? `2. TX Date: ${fields.tx_date_2}` : "",
    fields.tx_date_3 ? `3. TX Date: ${fields.tx_date_3}` : "",
    `Payment Type: ${fields.payment_type ?? "paid_guest"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeHeader(h: string): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getCell(row: Record<string, unknown>, ...aliases: string[]): string | number | Date {
  const keys = Object.keys(row).map((k) => normalizeHeader(k));
  for (const alias of aliases) {
    const n = normalizeHeader(alias);
    const idx = keys.findIndex((k) => k === n || k.includes(n) || n.includes(k));
    if (idx >= 0) {
      const key = Object.keys(row)[idx];
      const v = row[key];
      if (v == null) return "";
      if (typeof v === "string") return v.trim();
      if (typeof v === "number" || v instanceof Date) return v;
      return String(v).trim();
    }
  }
  return "";
}

/** Parse date from string, Excel serial number, or Date object. Returns YYYY-MM-DD or null. */
function parseDate(val: string | number | Date): string | null {
  if (val == null || (typeof val === "string" && !val.trim())) return null;
  if (typeof val === "string") {
    const t = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }
  if (typeof val === "number") {
    if (val < 1 || val > 2958465) return null;
    const jsDate = new Date((val - 25569) * 86400000);
    if (!Number.isNaN(jsDate.getTime())) return jsDate.toISOString().slice(0, 10);
    return null;
  }
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val.toISOString().slice(0, 10);
  return null;
}

function parseAmount(s: string): number | null {
  if (!s || !s.trim()) return null;
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "finance") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      return NextResponse.json(
        { error: "Invalid file type. Use Excel (.xlsx or .xls)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) {
      return NextResponse.json({ error: "Excel file has no sheets" }, { status: 400 });
    }
    const ws = wb.Sheets[firstSheet];
    // Skip title (row 1) and section header (row 2), use row 3 as column headers (0-indexed range: 2)
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range: 2 });

    if (rows.length === 0) {
      return NextResponse.json({ error: "Excel file has no data rows" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const userId = session.user.id;

    const [{ data: departments }, { data: programs }, { data: profiles }] = await Promise.all([
      supabase.from("departments").select("id, name"),
      supabase.from("programs").select("id, name, department_id"),
      supabase.from("profiles").select("id, full_name").eq("is_active", true),
    ]);
    const deptMap = new Map<string, string>((departments ?? []).map((d) => [d.name.trim().toLowerCase(), d.id]));
    const progMap = new Map<string, string>();
    for (const p of programs ?? []) {
      progMap.set(`${p.department_id}:${p.name.trim().toLowerCase()}`, p.id);
    }
    const producerMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      const name = (p.full_name ?? "").trim();
      if (name) producerMap.set(name.toLowerCase(), name);
    }

    const created: string[] = [];
    const errors: string[] = [];

    let currentSectionPaymentType = "paid_guest";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 4;

      const firstCell = String(Object.values(row)[0] ?? "").trim();
      if (firstCell === "Paid Invoices" || firstCell === "paid invoices") {
        currentSectionPaymentType = "paid_guest";
        continue;
      }
      if (firstCell === "No Payment Needed" || firstCell === "no payment needed") {
        currentSectionPaymentType = "unpaid_guest";
        continue;
      }
      if (firstCell === "Guest Name" || firstCell === "guest name") continue;

      const guestName = String(getCell(row, "Guest Name", "guest name", "guest_name") ?? "").trim();
      const paymentTypeRaw = String(getCell(row, "Payment Type", "payment type", "payment_type") ?? "").trim();
      const paymentType = paymentTypeRaw
        ? (/unpaid|no payment/i.test(paymentTypeRaw) || paymentTypeRaw.toLowerCase() === "unpaid"
            ? "unpaid_guest"
            : "paid_guest")
        : currentSectionPaymentType;

      if (!guestName) {
        errors.push(`Row ${rowNum}: Guest Name is required`);
        continue;
      }

      const departmentName = String(getCell(row, "Department", "department name") ?? "").trim();
      const programmeName = String(getCell(row, "Programme Name", "Programme", "programme name") ?? "").trim();
      let departmentId: string | null = null;
      let programId: string | null = null;
      if (departmentName) {
        departmentId = deptMap.get(departmentName.toLowerCase()) ?? null;
        if (departmentId && programmeName) {
          programId =
            progMap.get(`${departmentId}:${programmeName.toLowerCase()}`) ?? null;
        }
      }

      const title = String(getCell(row, "Title", "title") ?? "").trim() || undefined;
      const producerRaw = String(getCell(row, "Producer", "producer name") ?? "").trim();
      const producer = producerRaw
        ? (producerMap.get(producerRaw.toLowerCase()) ?? producerRaw)
        : undefined;
      const topic = String(getCell(row, "Topic", "topic") ?? "").trim() || undefined;
      const invoiceDate = parseDate(getCell(row, "Invoice Date", "invoice date"));
      const tx1 = parseDate(getCell(row, "TX Date", "TX Date 1", "tx date 1"));
      const tx2 = parseDate(getCell(row, "2. TX Date", "TX Date 2", "tx date 2"));
      const tx3 = parseDate(getCell(row, "3. TX Date", "TX Date 3", "tx date 3"));
      const accountName = String(getCell(row, "Account Name", "Beneficiary", "beneficiary_name") ?? "").trim() || null;
      const amount = parseAmount(String(getCell(row, "Amount", "Gross Amount", "gross_amount") ?? ""));
      const invNumber = String(getCell(row, "INV Number", "Invoice Number", "invoice_number") ?? "").trim() || null;
      const sortCode = String(getCell(row, "Sort Code", "sort_code") ?? "").trim() || null;
      const accountNumber = String(getCell(row, "Account Number", "account_number") ?? "").trim() || null;
      const paidDateRaw = getCell(row, "Payment Date", "Paid Date", "paid_date");

      const service_description = buildServiceDescription({
        guest_name: guestName,
        title,
        producer,
        topic,
        invoice_date: invoiceDate ?? undefined,
        tx_date_1: tx1 ?? undefined,
        tx_date_2: tx2 ?? undefined,
        tx_date_3: tx3 ?? undefined,
        payment_type: paymentType,
      });

      const status = paymentType === "unpaid_guest" ? "archived" : "paid";
      const paidDate = paymentType === "paid_guest" ? parseDate(paidDateRaw) : null;

      const invoiceId = crypto.randomUUID();

      const { error: invError } = await supabase.from("invoices").insert({
        id: invoiceId,
        submitter_user_id: userId,
        department_id: departmentId,
        program_id: programId,
        service_description,
        service_date_from: tx1,
        service_date_to: invoiceDate,
        currency: "GBP",
        storage_path: null,
        invoice_type: "guest",
      });

      if (invError) {
        errors.push(`Row ${rowNum}: ${invError.message}`);
        continue;
      }

      const { error: wfError } = await supabase.from("invoice_workflows").insert({
        invoice_id: invoiceId,
        status,
        paid_date: paidDate,
      });

      if (wfError) {
        await supabase.from("invoices").delete().eq("id", invoiceId);
        errors.push(`Row ${rowNum}: ${wfError.message}`);
        continue;
      }

      await supabase.from("invoice_extracted_fields").upsert(
        {
          invoice_id: invoiceId,
          beneficiary_name: accountName || null,
          account_number: accountNumber || null,
          sort_code: sortCode || null,
          invoice_number: invNumber || null,
          gross_amount: amount,
          extracted_currency: "GBP",
          needs_review: false,
          manager_confirmed: true,
          raw_json: { source: "excel_import", row: rowNum },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "invoice_id" }
      );

      await createAuditEvent({
        invoice_id: invoiceId,
        actor_user_id: userId,
        event_type: "invoice_imported",
        from_status: null,
        to_status: status,
        payload: { source: "excel", row: rowNum, guest_name: guestName },
      });

      created.push(invoiceId);
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
      created_ids: created,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
