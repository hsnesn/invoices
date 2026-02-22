import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuditEvent } from "@/lib/audit";

const BUCKET = "invoices";

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length ? v : null;
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
    if (!["admin", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: invoiceId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("invoices")
      .select("id, submitter_user_id, department_id, program_id, invoice_workflows(manager_user_id)")
      .eq("id", invoiceId)
      .single();
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (profile.role === "manager") {
      const wfRaw = (existing as Record<string, unknown>).invoice_workflows;
      const wf = Array.isArray(wfRaw) ? wfRaw[0] : wfRaw;
      const isAssigned = (wf as Record<string, unknown> | null)?.manager_user_id === session.user.id;
      const isOwner = existing.submitter_user_id === session.user.id;
      const inDept = profile.department_id != null && existing.department_id === profile.department_id;
      const inProg = (profile.program_ids ?? []).length > 0 && existing.program_id != null && (profile.program_ids ?? []).includes(existing.program_id);
      if (!isAssigned && !isOwner && !inDept && !inProg) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

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

    const { error: invUpdateError } = await supabase
      .from("invoices")
      .update({
        service_description,
        service_date_from: tx_date_1,
        service_date_to: tx_date_3 ?? tx_date_2 ?? tx_date_1,
      })
      .eq("id", invoiceId);

    if (invUpdateError) {
      return NextResponse.json(
        { error: "Invoice update failed: " + invUpdateError.message },
        { status: 500 }
      );
    }

    const { error: extractedUpdateError } = await supabase
      .from("invoice_extracted_fields")
      .upsert(
        {
          invoice_id: invoiceId,
          beneficiary_name: asString(body.beneficiary_name),
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

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "invoice_updated",
      payload: { fields: Object.keys(body) },
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
