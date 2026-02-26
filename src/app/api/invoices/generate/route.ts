import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSubmissionEmail } from "@/lib/email";
import { buildGuestEmailDetails } from "@/lib/guest-email-details";
import { isEmailStageEnabled, getFilteredEmailsForUserIds } from "@/lib/email-settings";
import { createAuditEvent } from "@/lib/audit";
import { generateGuestInvoicePdf, type GuestInvoiceAppearance, type GuestInvoiceExpense } from "@/lib/guest-invoice-pdf";
import { pickManagerForGuestInvoice } from "@/lib/manager-assignment";

const BUCKET = "invoices";
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

async function mergeSupportingFilesIntoPdf(
  mainPdfBuffer: ArrayBuffer,
  supportingFiles: { file: File; buf: Buffer }[]
): Promise<Uint8Array> {
  const MERGEABLE_EXT = ["pdf", "jpg", "jpeg", "png"];
  const toMerge = supportingFiles.filter(({ file }) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    return ext && MERGEABLE_EXT.includes(ext);
  });
  if (toMerge.length === 0) return new Uint8Array(mainPdfBuffer);

  const mainDoc = await PDFDocument.load(mainPdfBuffer);

  for (const { file, buf } of toMerge) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      try {
        const srcDoc = await PDFDocument.load(buf);
        const pages = await mainDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach((p) => mainDoc.addPage(p));
      } catch {
        // Skip invalid PDF
      }
    } else if (["jpg", "jpeg", "png"].includes(ext ?? "")) {
      try {
        const page = mainDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        const bytes = new Uint8Array(buf);
        const image = ext === "png"
          ? await mainDoc.embedPng(bytes)
          : await mainDoc.embedJpg(bytes);
        const dims = image.scaleToFit(A4_WIDTH - 40, A4_HEIGHT - 40);
        page.drawImage(image, {
          x: 20 + (A4_WIDTH - 40 - dims.width) / 2,
          y: A4_HEIGHT - 20 - dims.height,
          width: dims.width,
          height: dims.height,
        });
      } catch {
        // Skip invalid image
      }
    }
  }

  return mainDoc.save();
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    if (!safeDepartmentId) return NextResponse.json({ error: "Department is required" }, { status: 400 });
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
    const managerUserId = await pickManagerForGuestInvoice(
      supabaseAdmin,
      safeDepartmentId,
      safeProgramId
    );

    const { data: dept } = await supabaseAdmin.from("departments").select("name").eq("id", safeDepartmentId).single();
    const { data: prog } = safeProgramId
      ? await supabaseAdmin.from("programs").select("name").eq("id", safeProgramId).single()
      : { data: null };
    const deptName = dept?.name ?? "";
    const progName = prog?.name ?? "";

    const invoiceId = crypto.randomUUID();
    const pdfData = {
      invNo: data.invNo.trim(),
      invoiceDate: data.invoiceDate || new Date().toISOString().slice(0, 10),
      currency: data.currency || "GBP",
      guestName: data.guestName.trim(),
      guestAddress: data.guestAddress?.trim(),
      guestEmail: data.guestEmail?.trim(),
      guestPhone: data.guestPhone?.trim(),
      departmentName: deptName || undefined,
      programmeName: progName || undefined,
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

    let pdfBuffer = generateGuestInvoicePdf(pdfData);
    const supportingFiles = formData.getAll("supporting_files") as File[];
    const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "jpg", "jpeg", "png"];
    const supportingWithBuf: { file: File; buf: Buffer }[] = [];
    for (const f of supportingFiles) {
      if (!f?.name) continue;
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXT.includes(ext)) continue;
      supportingWithBuf.push({ file: f, buf: Buffer.from(await f.arrayBuffer()) });
    }

    let finalPdfBuffer: ArrayBuffer | Uint8Array = pdfBuffer;
    if (supportingWithBuf.length > 0) {
      finalPdfBuffer = await mergeSupportingFilesIntoPdf(pdfBuffer, supportingWithBuf);
    }

    const safeGuestName = data.guestName.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) || "invoice";
    const invoiceFileName = `${safeGuestName}_${data.invoiceDate}_INV-${data.invNo.trim()}.pdf`;
    const pdfPath = `${session.user.id}/${invoiceId}-generated-invoice.pdf`;

    const uploadBuf = finalPdfBuffer instanceof Uint8Array ? finalPdfBuffer : new Uint8Array(finalPdfBuffer);
    const { error: uploadErr } = await supabaseAdmin.storage.from(BUCKET).upload(pdfPath, Buffer.from(uploadBuf), {
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

    // Add PDF as first file (display name: GuestName_Date_INV-No.pdf)
    await supabaseAdmin.from("invoice_files").insert({
      invoice_id: invoiceId,
      storage_path: pdfPath,
      file_name: invoiceFileName,
      sort_order: 0,
    });

    // Add non-mergeable supporting files (docx, xlsx) as separate entries — PDFs and images were merged into main PDF
    const MERGEABLE_EXT = ["pdf", "jpg", "jpeg", "png"];
    let sortOrder = 1;
    for (const { file: f, buf } of supportingWithBuf) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext && MERGEABLE_EXT.includes(ext)) continue; // already merged
      const sp = `${session.user.id}/${invoiceId}-supporting-${sortOrder}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: sfErr } = await supabaseAdmin.storage.from(BUCKET).upload(sp, buf, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });
      if (!sfErr) {
        await supabaseAdmin.from("invoice_files").insert({
          invoice_id: invoiceId,
          storage_path: sp,
          file_name: f.name,
          sort_order: sortOrder,
        });
        sortOrder++;
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
