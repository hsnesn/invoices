/**
 * Bulk status change: approve, reject, ready_for_payment, paid.
 * Same permission rules as single status change.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditEvent } from "@/lib/audit";
import type { InvoiceStatus } from "@/lib/types";

const MAX_BULK = 50;

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request.headers);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }
    const { session, profile } = await requireAuth();
    const body = await request.json();
    const { invoice_ids, to_status, rejection_reason, payment_reference, paid_date, manager_confirmed } = body as {
      invoice_ids: string[];
      to_status: InvoiceStatus;
      rejection_reason?: string;
      payment_reference?: string;
      paid_date?: string;
      manager_confirmed?: boolean;
    };

    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0 || !to_status) {
      return NextResponse.json(
        { error: "invoice_ids (array) and to_status are required" },
        { status: 400 }
      );
    }
    if (invoice_ids.length > MAX_BULK) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BULK} invoices per request` },
        { status: 400 }
      );
    }

    const validBulkStatuses: InvoiceStatus[] = [
      "approved_by_manager",
      "rejected",
      "ready_for_payment",
      "paid",
      "archived",
      "pending_manager",
      "pending_admin",
    ];
    if (!validBulkStatuses.includes(to_status)) {
      return NextResponse.json(
        { error: `to_status must be one of: ${validBulkStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const userId = session.user.id;
    const failed: { id: string; error: string }[] = [];
    let success = 0;

    for (const invoiceId of invoice_ids) {
      try {
        const { data: inv } = await supabase
          .from("invoices")
          .select("submitter_user_id, department_id, program_id, invoice_type")
          .eq("id", invoiceId)
          .single();
        if (!inv) {
          failed.push({ id: invoiceId, error: "Not found" });
          continue;
        }

        const { data: wf } = await supabase
          .from("invoice_workflows")
          .select("*")
          .eq("invoice_id", invoiceId)
          .single();
        if (!wf) {
          failed.push({ id: invoiceId, error: "Workflow not found" });
          continue;
        }

        const fromStatus = (wf as { status: string }).status;
        const isAdmin = profile.role === "admin";
        const isFinance = profile.role === "finance";
        const isOperations = profile.role === "operations";
        const isOwner = inv.submitter_user_id === userId;
        const isAssigned = (wf as { manager_user_id: string | null }).manager_user_id === userId;

        let isDelegate = false;
        const managerId = (wf as { manager_user_id: string | null }).manager_user_id;
        if (managerId) {
          const today = new Date().toISOString().slice(0, 10);
          const { data: del } = await supabase
            .from("approval_delegations")
            .select("id")
            .eq("delegator_user_id", managerId)
            .eq("delegate_user_id", userId)
            .lte("valid_from", today)
            .gte("valid_until", today)
            .limit(1)
            .maybeSingle();
          isDelegate = !!del;
        }

        const { data: orMember } = await supabase
          .from("operations_room_members")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        const isOperationsRoom = !!orMember;

        const canAct =
          isAdmin ||
          isAssigned ||
          isDelegate ||
          (isOperations && fromStatus === "pending_admin") ||
          (isFinance && ["ready_for_payment", "paid", "archived"].includes(fromStatus));

        if (!canAct && !isOwner) {
          failed.push({ id: invoiceId, error: "Forbidden" });
          continue;
        }

        if (profile.role !== "admin" && inv.submitter_user_id === userId && (to_status === "approved_by_manager" || to_status === "rejected")) {
          failed.push({ id: invoiceId, error: "Cannot approve/reject own invoice" });
          continue;
        }

        let allowed = false;
        if (to_status === "approved_by_manager") {
          allowed = fromStatus === "pending_manager" || fromStatus === "submitted";
          if (allowed && (isAssigned || isDelegate || isAdmin)) {
            await supabase
              .from("invoice_workflows")
              .update({
                status: "approved_by_manager",
                rejection_reason: null,
                updated_at: new Date().toISOString(),
              })
              .eq("invoice_id", invoiceId);
            await createAuditEvent({ invoice_id: invoiceId, actor_user_id: userId, event_type: "status_change", from_status: fromStatus, to_status: "approved_by_manager", payload: { bulk: true, manager_confirmed: manager_confirmed ?? true } });
            success++;
          } else {
            failed.push({ id: invoiceId, error: "Invalid transition or permission" });
          }
        } else if (to_status === "rejected") {
          allowed = fromStatus === "pending_manager" || fromStatus === "submitted";
          if (allowed && (isAssigned || isDelegate || isAdmin) && rejection_reason?.trim()) {
            await supabase
              .from("invoice_workflows")
              .update({
                status: "rejected",
                rejection_reason: rejection_reason.trim(),
                updated_at: new Date().toISOString(),
              })
              .eq("invoice_id", invoiceId);
            await createAuditEvent({ invoice_id: invoiceId, actor_user_id: userId, event_type: "status_change", from_status: fromStatus, to_status: "rejected", payload: { bulk: true, rejection_reason: rejection_reason.trim() } });
            success++;
          } else {
            failed.push({ id: invoiceId, error: !rejection_reason?.trim() ? "Rejection reason required" : "Invalid transition or permission" });
          }
        } else if (to_status === "pending_admin") {
          allowed = (isAdmin || isOperationsRoom) && (fromStatus === "approved_by_manager" || fromStatus === "pending_manager");
          if (allowed) {
            await supabase
              .from("invoice_workflows")
              .update({ status: "pending_admin", updated_at: new Date().toISOString() })
              .eq("invoice_id", invoiceId);
            await createAuditEvent({ invoice_id: invoiceId, actor_user_id: userId, event_type: "status_change", from_status: fromStatus, to_status: "pending_admin", payload: { bulk: true } });
            success++;
          } else {
            failed.push({ id: invoiceId, error: "Admin/Operations only; invalid from status" });
          }
        } else if (to_status === "ready_for_payment") {
          allowed = isAdmin && ["approved_by_manager", "pending_admin"].includes(fromStatus);
          if (allowed) {
            await supabase
              .from("invoice_workflows")
              .update({ status: "ready_for_payment", updated_at: new Date().toISOString() })
              .eq("invoice_id", invoiceId);
            await createAuditEvent({ invoice_id: invoiceId, actor_user_id: userId, event_type: "status_change", from_status: fromStatus, to_status: "ready_for_payment", payload: { bulk: true } });
            success++;
          } else {
            failed.push({ id: invoiceId, error: "Admin only; invalid from status" });
          }
        } else if (to_status === "paid") {
          allowed = (isAdmin || isFinance) && fromStatus === "ready_for_payment";
          if (allowed) {
            const paidDate = paid_date ?? new Date().toISOString().slice(0, 10);
            await supabase
              .from("invoice_workflows")
              .update({
                status: "paid",
                payment_reference: payment_reference ?? null,
                paid_date: paidDate,
                updated_at: new Date().toISOString(),
              })
              .eq("invoice_id", invoiceId);
            await createAuditEvent({ invoice_id: invoiceId, actor_user_id: userId, event_type: "status_change", from_status: fromStatus, to_status: "paid", payload: { bulk: true, payment_reference: payment_reference ?? undefined, paid_date: paidDate } });
            success++;
          } else {
            failed.push({ id: invoiceId, error: "Finance/Admin only; must be ready_for_payment" });
          }
        } else if (to_status === "archived") {
          allowed = (isAdmin || isFinance) && fromStatus === "paid";
          if (allowed) {
            await supabase
              .from("invoice_workflows")
              .update({ status: "archived", updated_at: new Date().toISOString() })
              .eq("invoice_id", invoiceId);
            await createAuditEvent({ invoice_id: invoiceId, actor_user_id: userId, event_type: "status_change", from_status: fromStatus, to_status: "archived", payload: { bulk: true } });
            success++;
          } else {
            failed.push({ id: invoiceId, error: "Can only archive paid invoices" });
          }
        } else if (to_status === "pending_manager") {
          allowed = isAdmin && ["rejected", "ready_for_payment", "approved_by_manager", "pending_admin", "paid", "archived", "submitted"].includes(fromStatus);
          if (allowed) {
            const today = new Date().toISOString().slice(0, 10);
            await supabase
              .from("invoice_workflows")
              .update({
                status: "pending_manager",
                pending_manager_since: today,
                rejection_reason: fromStatus === "rejected" ? null : (wf as { rejection_reason: string | null }).rejection_reason,
                updated_at: new Date().toISOString(),
              })
              .eq("invoice_id", invoiceId);
            await createAuditEvent({ invoice_id: invoiceId, actor_user_id: userId, event_type: "status_change", from_status: fromStatus, to_status: "pending_manager", payload: { bulk: true } });
            success++;
          } else {
            failed.push({ id: invoiceId, error: "Admin only; invalid from status" });
          }
        } else {
          failed.push({ id: invoiceId, error: "Unsupported bulk status" });
        }
      } catch (e) {
        failed.push({ id: invoiceId, error: (e as Error).message });
      }
    }

    return NextResponse.json({ success, failed });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
