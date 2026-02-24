import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuditEvent } from "@/lib/audit";
import { sendManagerAssignedEmail } from "@/lib/email";

const BUCKET = "invoices";

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length ? v : null;
}

function parseOldDescription(desc: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of desc.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase();
      result[key] = line.slice(idx + 1).trim();
    }
  }
  return result;
}

function diffChanges(
  oldDesc: Record<string, string>,
  oldExtracted: Record<string, unknown> | null,
  oldDeptId: string | null,
  oldProgId: string | null,
  oldManagerId: string | null,
  newFields: Record<string, unknown>
): Record<string, { from: string; to: string }> {
  const changes: Record<string, { from: string; to: string }> = {};
  const map: [string, string, string][] = [
    ["guest_name", "guest name", "guest_name"],
    ["title", "title", "title"],
    ["producer", "producer", "producer"],
    ["topic", "topic", "topic"],
    ["invoice_date", "invoice date", "invoice_date"],
    ["tx_date_1", "tx date", "tx_date_1"],
    ["tx_date_2", "2. tx date", "tx_date_2"],
    ["tx_date_3", "3. tx date", "tx_date_3"],
    ["payment_type", "payment type", "payment_type"],
  ];
  for (const [bodyKey, descKey] of map) {
    const oldVal = (oldDesc[descKey] ?? "").trim();
    const newVal = String(newFields[bodyKey] ?? "").trim();
    if (newVal && oldVal !== newVal) changes[bodyKey] = { from: oldVal, to: newVal };
  }
  const extMap: [string, string][] = [
    ["beneficiary_name", "Account Name"],
    ["account_number", "Account Number"],
    ["sort_code", "Sort Code"],
    ["invoice_number", "Invoice Number"],
    ["gross_amount", "Amount"],
  ];
  for (const [key, label] of extMap) {
    const oldVal = String((oldExtracted as Record<string, unknown>)?.[key] ?? "").trim();
    const newVal = String(newFields[key] ?? "").trim();
    if (newVal && oldVal !== newVal) changes[label] = { from: oldVal || "—", to: newVal };
  }
  if (newFields.department_id !== undefined) {
    const o = oldDeptId ?? "";
    const n = String(newFields.department_id ?? "");
    if (o !== n) changes["department_id"] = { from: o || "—", to: n || "—" };
  }
  if (newFields.program_id !== undefined) {
    const o = oldProgId ?? "";
    const n = String(newFields.program_id ?? "");
    if (o !== n) changes["program_id"] = { from: o || "—", to: n || "—" };
  }
  if (newFields.manager_user_id !== undefined) {
    const o = oldManagerId ?? "";
    const n = String(newFields.manager_user_id ?? "");
    if (o !== n) changes["manager"] = { from: o || "Unassigned", to: n || "Unassigned" };
  }
  return changes;
}

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("invoices")
      .select("id, submitter_user_id, department_id, program_id, service_description, invoice_workflows(status, manager_user_id)")
      .eq("id", invoiceId)
      .single();
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const wfRaw = (existing as Record<string, unknown>).invoice_workflows;
    const wf = Array.isArray(wfRaw) ? wfRaw[0] : wfRaw;
    const wfStatus = (wf as Record<string, unknown> | null)?.status as string | undefined;

    if (profile.role === "submitter") {
      const isOwner = existing.submitter_user_id === session.user.id;
      const editableStatuses = ["submitted", "pending_manager", "rejected"];
      if (!isOwner || !editableStatuses.includes(wfStatus ?? "submitted")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role === "manager") {
      const isAssigned = (wf as Record<string, unknown> | null)?.manager_user_id === session.user.id;
      const isOwner = existing.submitter_user_id === session.user.id;
      const inDept = profile.department_id != null && existing.department_id === profile.department_id;
      const inProg = (profile.program_ids ?? []).length > 0 && existing.program_id != null && (profile.program_ids ?? []).includes(existing.program_id);
      if (!isAssigned && !isOwner && !inDept && !inProg) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: oldExtracted } = await supabase
      .from("invoice_extracted_fields")
      .select("beneficiary_name, account_number, sort_code, invoice_number, gross_amount")
      .eq("invoice_id", invoiceId)
      .single();

    const oldDesc = parseOldDescription(existing.service_description ?? "");

    const guest_name = asString(body.guest_name);
    const title = asString(body.title);
    const producer = asString(body.producer);
    const topic = asString(body.topic);
    const invoice_date = asString(body.invoice_date);
    const tx_date_1 = asString(body.tx_date_1);
    const tx_date_2 = asString(body.tx_date_2);
    const tx_date_3 = asString(body.tx_date_3);
    const payment_type = asString(body.payment_type) ?? "paid_guest";

    const service_description = buildServiceDescription({
      guest_name,
      title,
      producer,
      topic,
      invoice_date,
      tx_date_1,
      tx_date_2,
      tx_date_3,
      payment_type,
    });

    const invoiceUpdate: Record<string, unknown> = {
      service_description,
      service_date_from: tx_date_1,
      service_date_to: tx_date_3 ?? tx_date_2 ?? tx_date_1,
    };
    if (body.department_id !== undefined) invoiceUpdate.department_id = body.department_id || null;
    if (body.program_id !== undefined) invoiceUpdate.program_id = body.program_id || null;

    const { error: invUpdateError } = await supabase
      .from("invoices")
      .update(invoiceUpdate)
      .eq("id", invoiceId);

    if (invUpdateError) {
      return NextResponse.json(
        { error: "Invoice update failed: " + invUpdateError.message },
        { status: 500 }
      );
    }

    const beneficiaryRaw = asString(body.beneficiary_name);
    const guestName = asString(body.guest_name);
    const beneficiarySanitized = beneficiaryRaw && !/trt/i.test(beneficiaryRaw) ? beneficiaryRaw : guestName;

    const { error: extractedUpdateError } = await supabase
      .from("invoice_extracted_fields")
      .upsert(
        {
          invoice_id: invoiceId,
          beneficiary_name: beneficiarySanitized,
          account_number: asString(body.account_number),
          sort_code: asString(body.sort_code),
          invoice_number: asString(body.invoice_number),
          gross_amount:
            typeof body.gross_amount === "number"
              ? body.gross_amount
              : typeof body.gross_amount === "string" && body.gross_amount.trim()
              ? Number(body.gross_amount)
              : null,
          extracted_currency: asString(body.extracted_currency) ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "invoice_id" }
      );

    if (extractedUpdateError) {
      return NextResponse.json(
        { error: "Extracted field update failed: " + extractedUpdateError.message },
        { status: 500 }
      );
    }

    if (body.manager_user_id !== undefined && profile.role === "admin") {
      const newManagerId = (body.manager_user_id as string) || null;
      const prevManagerId = (wf as Record<string, unknown> | null)?.manager_user_id as string | null;
      const { error: wfError } = await supabase
        .from("invoice_workflows")
        .update({
          manager_user_id: newManagerId,
          updated_at: new Date().toISOString(),
        })
        .eq("invoice_id", invoiceId);
      if (wfError) {
        return NextResponse.json(
          { error: "Manager assignment failed: " + wfError.message },
          { status: 500 }
        );
      }
      if (newManagerId && newManagerId !== prevManagerId) {
        const { data: mUser } = await supabase.auth.admin.getUserById(newManagerId);
        const { data: extracted } = await supabase
          .from("invoice_extracted_fields")
          .select("invoice_number")
          .eq("invoice_id", invoiceId)
          .single();
        if (mUser?.user?.email) {
          await sendManagerAssignedEmail({
            managerEmail: mUser.user.email,
            invoiceId,
            invoiceNumber: extracted?.invoice_number ?? undefined,
            assignedByName: profile.full_name ?? undefined,
          });
        }
      }
    }

    const oldManagerId = (wf as Record<string, unknown> | null)?.manager_user_id as string | null;
    const changes = diffChanges(
      oldDesc,
      oldExtracted,
      existing.department_id,
      existing.program_id,
      oldManagerId,
      { ...body, payment_type }
    );

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "invoice_updated",
      payload: { changes },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, storage_path")
      .eq("id", invoiceId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "invoice_deleted",
      payload: {},
    });

    const { error: deleteError } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Delete failed: " + deleteError.message },
        { status: 500 }
      );
    }

    if (invoice.storage_path) {
      await supabase.storage.from(BUCKET).remove([invoice.storage_path]);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
