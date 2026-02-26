import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSubmissionEmail } from "@/lib/email";
import { parseGuestNameFromServiceDesc } from "@/lib/guest-utils";
import { buildGuestEmailDetails } from "@/lib/guest-email-details";
import { isEmailStageEnabled, getFilteredEmailsForUserIds } from "@/lib/email-settings";
import { createAuditEvent } from "@/lib/audit";
import { generateGuestInvoicePdf, type GuestInvoiceAppearance, type GuestInvoiceExpense } from "@/lib/guest-invoice-pdf";

const BUCKET = "invoices";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ManagerProfile = { id: string; department_id: string | null; program_ids: string[] | null };

function pickManager(managers: ManagerProfile[], departmentId: string | null, programId: string | null): string | null {
  if (!managers.length) return null;
  if (programId) {
    const byProgram = managers.find((m) => Array.isArray(m.program_ids) && m.program_ids.includes(programId));
    if (byProgram) return byProgram.id;
  }
  if (departmentId) {
    const byDepartment = managers.find((m) => m.department_id === departmentId);
    if (byDepartment) return byDepartment.id;
  }
  return managers[0].id;
}

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request.headers);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }
    const { session } = await requireAuth();

    const formData = await request.formData();
    const jsonStr = formData.get("data") as string | null;
    if (!jsonStr) {
      return NextResponse.json({ error: "Missing form data" }, { status: 400 });
    }

    const data = JSON.parse(jsonStr) as {
      invNo: string;
      invoiceDate: string;
      currency: "GBP" | "EUR" | "USD";
      guestName: string;
      guestAddress?: string;
      guestEmail?: string;
      guestPhone?: string;
      appearances: GuestInvoiceAppearance[];
      expenses: GuestInvoiceExpense[];
      paypal?: string;
      accountName: string;
      bankName?: string;
      accountNumber: string;
      sortCode: string;
      bankAddress?: string;
      department_id: string;
      program_id: string;
      title: string;
      producer: string;
    };

    const useStrictUuid = process.env.DEV_BYPASS_AUTH !== "true";
    const safeDepartmentId = !useStrictUuid && data.department_id ? null : data.department_id && UUID_RE.test(data.department_id) ? data.department_id : null;
    const safeProgramId = !useStrictUuid && data.program_id ? null : data.program_id && UUID_RE.test(data.program_id) ? data.program_id : null;

    if (!data.invNo?.trim()) return NextResponse.json({ error: "INV NO is required" }, { status: 400 });
    if (!data.guestName?.trim()) return NextResponse.json({ error: "Guest name is required" }, { status: 400 });
    if (!data.appearances?.length) return NextResponse.json({ error: "At least one appearance is required" }, { status: 400 });
    if (!data.accountName?.trim() || !data.accountNumber?.trim() || !data.sortCode?.trim()) {
      return NextResponse.json({ error: "Account name, account number and sort code are required" }, { status: 400 });
    }
    if (!safeDepartmentId || !safeProgramId) return NextResponse.json({ error: "Department and programme are required" }, { status: 400 });
    if (!data.title?.trim() || !data.producer?.trim()) return NextResponse.json({ error: "Title and producer are required for list display" }, { status: 400 });

    const appearances = data.appearances.map((a) => ({
      programmeName: a.programmeName || "",
      topic: a.topic || "",
      date: a.date || "",
      amount: Number(a.amount) || 0,
    }));
    const expenses = (data.expenses || []).map((e) => ({ label: e.label || "", amount: Number(e.amount) || 0 })).filter((e) => e.label.trim());

    const subtotal = appearances.reduce((s, a) => s + a.amount, 0);
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const totalAmount = subtotal + expenseTotal;

    const supabaseAdmin = createAdminClient();
    let managerUserId: string | null = null;
    if (safeDepartmentId) {
      const { data: dm } = await supabaseAdmin.from("department_managers").select("manager_user_id").eq("department_id", safeDepartmentId).order("sort_order").limit(1).maybeSingle();
      managerUserId = dm?.manager_user_id ?? null;
    }
    if (!managerUserId && safeProgramId) {
      const { data: managerProfiles } = await supabaseAdmin.from("profiles").select("id,department_id,program_ids").eq("role", "manager").eq("is_active", true);
      managerUserId = pickManager((managerProfiles ?? []) as ManagerProfile[], safeDepartmentId, safeProgramId);
    }

    const invoiceId = crypto.randomUUID();
    const pdfData = {
      invNo: data.invNo.trim(),
      invoiceDate: data.invoiceDate || new Date().toISOString().slice(0, 10),
      currency: data.currency || "GBP",
      guestName: data.guestName.trim(),
      guestAddress: data.guestAddress?.trim(),
      guestEmail: data.guestEmail?.trim(),
      guestPhone: data.guestPhone?.trim(),
      appearances,
      expenses,
      totalAmount,
      paypal: data.paypal?.trim(),
      accountName: data.accountName.trim(),
      bankName: data.bankName?.trim(),
      accountNumber: data.accountNumber.trim(),
      sortCode: data.sortCode.trim(),
      bankAddress: data.bankAddress?.trim(),
    };

    const pdfBuffer = generateGuestInvoicePdf(pdfData);
    const pdfPath = `${session.user.id}/${invoiceId}-generated-invoice.pdf`;

    const { error: uploadErr } = await supabaseAdmin.storage.from(BUCKET).upload(pdfPath, Buffer.from(pdfBuffer), {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadErr) {
      return NextResponse.json({ error: "PDF upload failed: " + uploadErr.message }, { status: 500 });
    }

    const txDates = appearances.map((a) => a.date).filter(Boolean);
    const service_description = [
      `Guest Name: ${data.guestName}`,
      `Title: ${data.title}`,
      `Producer: ${data.producer}`,
      `Topic: ${appearances.map((a) => a.topic).filter(Boolean).join("; ") || "—"}`,
      `Department Name: ${""}`,
      `Programme Name: ${""}`,
      `Invoice Date: ${data.invoiceDate}`,
      txDates.length > 0 ? `TX Date: ${txDates[0]}` : "",
      txDates.length > 1 ? `2. TX Date: ${txDates[1]}` : "",
      txDates.length > 2 ? `3. TX Date: ${txDates[2]}` : "",
      `Payment Type: paid_guest`,
      `Source: Generated`,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: dept } = await supabaseAdmin.from("departments").select("name").eq("id", safeDepartmentId).single();
    const { data: prog } = await supabaseAdmin.from("programs").select("name").eq("id", safeProgramId).single();
    const deptName = dept?.name ?? "";
    const progName = prog?.name ?? "";
    const serviceDescWithDept = service_description
      .replace("Department Name: ", `Department Name: ${deptName}`)
      .replace("Programme Name: ", `Programme Name: ${progName}`);

    const { error: invError } = await supabaseAdmin.from("invoices").insert({
      id: invoiceId,
      submitter_user_id: session.user.id,
      department_id: safeDepartmentId,
      program_id: safeProgramId,
      service_description: serviceDescWithDept,
      service_date_from: txDates[0] || data.invoiceDate,
      service_date_to: txDates[txDates.length - 1] || data.invoiceDate,
      currency: data.currency || "GBP",
      storage_path: pdfPath,
      invoice_type: "guest",
      generated_invoice_data: {
        appearances,
        expenses,
        paypal: data.paypal?.trim() || null,
      },
    });

    if (invError) {
      await supabaseAdmin.storage.from(BUCKET).remove([pdfPath]);
      return NextResponse.json({ error: "Invoice insert failed: " + invError.message }, { status: 500 });
    }

    const { error: wfError } = await supabaseAdmin.from("invoice_workflows").insert({
      invoice_id: invoiceId,
      status: "pending_manager",
      manager_user_id: managerUserId,
    });

    if (wfError) {
      await supabaseAdmin.from("invoices").delete().eq("id", invoiceId);
      await supabaseAdmin.storage.from(BUCKET).remove([pdfPath]);
      return NextResponse.json({ error: "Workflow insert failed: " + wfError.message }, { status: 500 });
    }

    await supabaseAdmin.from("invoice_extracted_fields").upsert(
      {
        invoice_id: invoiceId,
        invoice_number: data.invNo.trim(),
        beneficiary_name: data.accountName.trim(),
        account_number: data.accountNumber.trim(),
        sort_code: data.sortCode.trim(),
        gross_amount: totalAmount,
        extracted_currency: data.currency || "GBP",
        needs_review: false,
        manager_confirmed: false,
        raw_json: { source: "generated" },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "invoice_id" }
    );

    // Add PDF as first file
    await supabaseAdmin.from("invoice_files").insert({
      invoice_id: invoiceId,
      storage_path: pdfPath,
      file_name: `invoice-${data.invNo}.pdf`,
      sort_order: 0,
    });

    // Add supporting files (tickets, etc.)
    const supportingFiles = formData.getAll("supporting_files") as File[];
    const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "jpg", "jpeg", "png"];
    for (let i = 0; i < supportingFiles.length; i++) {
      const f = supportingFiles[i];
      if (!f?.name) continue;
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXT.includes(ext)) continue;
      const buf = Buffer.from(await f.arrayBuffer());
      const sp = `${session.user.id}/${invoiceId}-supporting-${i}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: sfErr } = await supabaseAdmin.storage.from(BUCKET).upload(sp, buf, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });
      if (!sfErr) {
        await supabaseAdmin.from("invoice_files").insert({
          invoice_id: invoiceId,
          storage_path: sp,
          file_name: f.name,
          sort_order: i + 1,
        });
      }
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "invoice_submitted",
      from_status: null,
      to_status: "pending_manager",
      payload: { source: "generated", storage_path: pdfPath },
    });

    const enabled = await isEmailStageEnabled("submission");
    if (enabled && managerUserId) {
      const managerEmails = await getFilteredEmailsForUserIds([managerUserId]);
      const submitterEmails = await getFilteredEmailsForUserIds([session.user.id]);
      const submitterEmail = submitterEmails[0];
      if (submitterEmail || managerEmails.length > 0) {
        const guestDetails = buildGuestEmailDetails(serviceDescWithDept, deptName, progName, {
          invoice_number: data.invNo.trim(),
          gross_amount: totalAmount,
        });
        await sendSubmissionEmail({
          submitterEmail: submitterEmail ?? "",
          managerEmails,
          invoiceId,
          invoiceNumber: data.invNo.trim(),
          guestName: data.guestName.trim(),
          guestDetails,
        });
      }
    }

    return NextResponse.json({ success: true, invoice_id: invoiceId });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
