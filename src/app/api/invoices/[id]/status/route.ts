import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";
import {
  sendManagerApprovedEmail,
  sendManagerRejectedEmail,
  sendReadyForPaymentEmail,
  sendPaidEmail,
} from "@/lib/email";
import type { InvoiceStatus } from "@/lib/types";
import { notifyWebhooks } from "@/lib/webhook";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;

    const body = await request.json();
    const {
      to_status,
      rejection_reason,
      admin_comment,
      payment_reference,
      paid_date,
      manager_confirmed,
    } = body as {
      to_status: InvoiceStatus;
      rejection_reason?: string;
      admin_comment?: string;
      payment_reference?: string;
      paid_date?: string;
      manager_confirmed?: boolean;
    };

    if (!to_status) {
      return NextResponse.json(
        { error: "to_status is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: inv } = await supabase
      .from("invoices")
      .select("submitter_user_id, department_id, program_id")
      .eq("id", invoiceId)
      .single();
    if (!inv) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: wf } = await supabase
      .from("invoice_workflows")
      .select("*")
      .eq("invoice_id", invoiceId)
      .single();

    if (!wf) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const userId = session.user.id;
    const isOwner = inv.submitter_user_id === userId;
    const isAssigned = wf.manager_user_id === userId;
    const isAdmin = profile.role === "admin";
    const isFinance = profile.role === "finance" && ["ready_for_payment", "paid", "archived"].includes(wf.status);
    const inDept = profile.role === "manager" && profile.department_id != null && inv.department_id === profile.department_id;
    const inProg = profile.role === "manager" && (profile.program_ids ?? []).length > 0 && inv.program_id != null && (profile.program_ids ?? []).includes(inv.program_id);

    if (!isOwner && !isAssigned && !isAdmin && !isFinance && !inDept && !inProg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const fromStatus = wf.status;
    const { data: extracted } = await supabase
      .from("invoice_extracted_fields")
      .select("manager_confirmed, invoice_number")
      .eq("invoice_id", invoiceId)
      .single();

    // Submitters cannot approve/reject their own invoices (admins exempt)
    if (profile.role !== "admin" && inv.submitter_user_id === userId && (to_status === "approved_by_manager" || to_status === "rejected")) {
      return NextResponse.json(
        { error: "You cannot approve or reject your own invoice" },
        { status: 403 }
      );
    }

    // Role-based transition checks
    if (profile.role === "manager") {
      if (to_status === "approved_by_manager") {
        if (!manager_confirmed && !extracted?.manager_confirmed) {
          return NextResponse.json(
            { error: "Manager must confirm bank details before approval" },
            { status: 400 }
          );
        }
        if (fromStatus !== "pending_manager") {
          return NextResponse.json(
            { error: "Invalid transition" },
            { status: 400 }
          );
        }
        await supabase
          .from("invoice_workflows")
          .update({
            status: "ready_for_payment",
            manager_user_id: session.user.id,
          })
          .eq("invoice_id", invoiceId);

        const submitterUser = (await supabase.auth.admin.getUserById(inv.submitter_user_id))
          .data?.user;
        const financeProfiles = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "finance")
          .eq("is_active", true);
        const financeEmails: string[] = [];
        for (const p of financeProfiles.data ?? []) {
          const u = (await supabase.auth.admin.getUserById(p.id)).data?.user;
          if (u?.email) financeEmails.push(u.email);
        }
        const adminProfiles = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .eq("is_active", true);
        const adminEmails: string[] = [];
        for (const p of adminProfiles.data ?? []) {
          const u = (await supabase.auth.admin.getUserById(p.id)).data?.user;
          if (u?.email) adminEmails.push(u.email);
        }
        if (submitterUser?.email) {
          await sendReadyForPaymentEmail({
            submitterEmail: submitterUser.email,
            financeEmails,
            invoiceId,
            invoiceNumber: extracted?.invoice_number ?? undefined,
          });
        }
      } else if (to_status === "rejected") {
        if (!rejection_reason?.trim()) {
          return NextResponse.json(
            { error: "rejection_reason is required" },
            { status: 400 }
          );
        }
        if (fromStatus !== "pending_manager") {
          return NextResponse.json(
            { error: "Invalid transition" },
            { status: 400 }
          );
        }
        await supabase
          .from("invoice_workflows")
          .update({
            status: "rejected",
            rejection_reason,
            manager_user_id: session.user.id,
          })
          .eq("invoice_id", invoiceId);

        const { data: submitter } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", inv.submitter_user_id)
          .single();
        const submitterEmail = (await supabase.auth.admin.getUserById(inv.submitter_user_id))
          .data?.user?.email;
        if (submitterEmail) {
          await sendManagerRejectedEmail({
            submitterEmail,
            invoiceId,
            reason: rejection_reason,
            invoiceNumber: extracted?.invoice_number ?? undefined,
          });
        }
      } else {
        return NextResponse.json({ error: "Invalid manager action" }, { status: 400 });
      }
    } else if (profile.role === "admin") {
      if (to_status === "approved_by_manager") {
        if (fromStatus !== "pending_manager") {
          return NextResponse.json(
            { error: "Invalid transition" },
            { status: 400 }
          );
        }
        await supabase
          .from("invoice_workflows")
          .update({
            status: "ready_for_payment",
            manager_user_id: session.user.id,
          })
          .eq("invoice_id", invoiceId);
      } else if (to_status === "ready_for_payment") {
        const validFrom = ["pending_manager", "approved_by_manager", "pending_admin"];
        if (!validFrom.includes(fromStatus)) {
          return NextResponse.json(
            { error: "Invalid transition" },
            { status: 400 }
          );
        }
        await supabase
          .from("invoice_workflows")
          .update({
            status: "ready_for_payment",
            admin_comment: admin_comment ?? wf.admin_comment,
          })
          .eq("invoice_id", invoiceId);

        const financeProfiles = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "finance")
          .eq("is_active", true);
        const financeIds = financeProfiles.data?.map((p) => p.id) ?? [];
        const financeEmails: string[] = [];
        for (const fid of financeIds) {
          const u = (await supabase.auth.admin.getUserById(fid)).data?.user;
          if (u?.email) financeEmails.push(u.email);
        }
        const submitterUser = (await supabase.auth.admin.getUserById(inv.submitter_user_id))
          .data?.user;
        const adminProfiles = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .eq("is_active", true);
        const adminIds = adminProfiles.data?.map((p) => p.id) ?? [];
        const adminEmails: string[] = [];
        for (const aid of adminIds) {
          const u = (await supabase.auth.admin.getUserById(aid)).data?.user;
          if (u?.email) adminEmails.push(u.email);
        }
        if (submitterUser?.email) {
          await sendReadyForPaymentEmail({
            submitterEmail: submitterUser.email,
            financeEmails,
            invoiceId,
            invoiceNumber: extracted?.invoice_number ?? undefined,
          });
        }
      } else if (to_status === "rejected") {
        if (!rejection_reason?.trim()) {
          return NextResponse.json(
            { error: "rejection_reason is required" },
            { status: 400 }
          );
        }
        await supabase
          .from("invoice_workflows")
          .update({
            status: "rejected",
            rejection_reason,
            admin_comment: admin_comment ?? wf.admin_comment,
          })
          .eq("invoice_id", invoiceId);
      } else if (to_status === "paid") {
        if (fromStatus !== "ready_for_payment") {
          return NextResponse.json(
            { error: "Invalid transition" },
            { status: 400 }
          );
        }
        await supabase
          .from("invoice_workflows")
          .update({
            status: "paid",
            payment_reference: payment_reference ?? null,
            paid_date: paid_date ?? new Date().toISOString().split("T")[0],
          })
          .eq("invoice_id", invoiceId);
      } else if (to_status === "archived") {
        await supabase
          .from("invoice_workflows")
          .update({ status: "archived" })
          .eq("invoice_id", invoiceId);
      } else if (to_status === "pending_manager" && fromStatus === "rejected") {
        await supabase
          .from("invoice_workflows")
          .update({
            status: "pending_manager",
            rejection_reason: null,
          })
          .eq("invoice_id", invoiceId);
      } else {
        return NextResponse.json({ error: "Invalid admin action" }, { status: 400 });
      }
    } else if (profile.role === "finance") {
      if (to_status === "paid") {
        if (fromStatus !== "ready_for_payment") {
          return NextResponse.json(
            { error: "Invalid transition" },
            { status: 400 }
          );
        }
        await supabase
          .from("invoice_workflows")
          .update({
            status: "paid",
            payment_reference: payment_reference ?? null,
            paid_date: paid_date ?? new Date().toISOString().split("T")[0],
          })
          .eq("invoice_id", invoiceId);

        const submitterUser = (await supabase.auth.admin.getUserById(inv.submitter_user_id))
          .data?.user;
        const adminProfiles = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .eq("is_active", true);
        const adminEmails: string[] = [];
        for (const p of adminProfiles.data ?? []) {
          const u = (await supabase.auth.admin.getUserById(p.id)).data?.user;
          if (u?.email) adminEmails.push(u.email);
        }
        if (submitterUser?.email) {
          await sendPaidEmail({
            submitterEmail: submitterUser.email,
            adminEmails,
            invoiceId,
            paymentReference: payment_reference,
            invoiceNumber: extracted?.invoice_number ?? undefined,
          });
        }
      } else if (to_status === "archived") {
        if (fromStatus !== "paid") {
          return NextResponse.json(
            { error: "Can only archive paid invoices" },
            { status: 400 }
          );
        }
        await supabase
          .from("invoice_workflows")
          .update({ status: "archived" })
          .eq("invoice_id", invoiceId);
      } else {
        return NextResponse.json({ error: "Invalid finance action" }, { status: 400 });
      }
    } else if (profile.role === "submitter" || isOwner) {
      if (to_status === "pending_manager" && fromStatus === "rejected") {
        await supabase
          .from("invoice_workflows")
          .update({
            status: "pending_manager",
            rejection_reason: null,
          })
          .eq("invoice_id", invoiceId);
      } else {
        return NextResponse.json({ error: "Invalid submitter action" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update manager_confirmed if provided
    if (manager_confirmed !== undefined && extracted) {
      await supabase
        .from("invoice_extracted_fields")
        .update({ manager_confirmed })
        .eq("invoice_id", invoiceId);
    }

    try {
      await createAuditEvent({
        invoice_id: invoiceId,
        actor_user_id: session.user.id,
        event_type: "status_change",
        from_status: fromStatus,
        to_status: to_status,
        payload: {
          rejection_reason: rejection_reason ?? undefined,
          admin_comment: admin_comment ?? undefined,
          payment_reference: payment_reference ?? undefined,
          paid_date: paid_date ?? undefined,
        },
      });
    } catch (auditErr) {
      console.error("Audit event failed (non-fatal):", auditErr);
    }

    try {
      await notifyWebhooks(`Invoice ${invoiceId}: ${fromStatus} → ${to_status} by ${profile.full_name || session.user.id}${rejection_reason ? ` (reason: ${rejection_reason})` : ""}`);
    } catch (webhookErr) {
      console.error("Webhook notification failed (non-fatal):", webhookErr);
    }

    return NextResponse.json({ success: true, to_status });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
