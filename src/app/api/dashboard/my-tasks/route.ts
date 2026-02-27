/**
 * Returns pending tasks for the current user only.
 * Only invoices that require this user's action are counted.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type WfShape = { status: string; manager_user_id: string | null };

function unwrap<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function parseProducerFromServiceDesc(serviceDescription: string | null): string | null {
  if (!serviceDescription) return null;
  for (const line of serviceDescription.split("\n")) {
    const l = line.trim();
    if (l.toLowerCase().startsWith("producer:")) {
      const val = l.slice(l.indexOf(":") + 1).trim();
      return val || null;
    }
  }
  return null;
}

function producerMatches(producer: string | null, userFullName: string | null): boolean {
  if (!producer || !userFullName) return false;
  return producer.trim().toLowerCase() === userFullName.trim().toLowerCase();
}

export async function GET() {
  try {
    const { session, profile } = await requireAuth();
    const userId = session.user.id;
    const role = profile.role;
    const fullName = profile.full_name ?? null;
    const canSeeOther = role === "admin" || role === "finance" || role === "operations" || (role === "viewer" && profile.allowed_pages?.includes("other_invoices"));

    const supabase = createAdminClient();

    const { data: orMembers } = await supabase.from("operations_room_members").select("user_id").eq("user_id", userId).maybeSingle();
    const isOperationsRoomMember = !!orMembers || role === "operations";

    const guest = { pending: 0 };
    const freelancer = { pending: 0 };
    const other = { pending: 0 };

    // Guest & salary invoices
    const { data: guestInvoices } = await supabase
      .from("invoices")
      .select("id, submitter_user_id, service_description, invoice_workflows(status, manager_user_id)")
      .in("invoice_type", ["guest", "salary"]);

    for (const inv of guestInvoices ?? []) {
      const wf = unwrap(inv.invoice_workflows as WfShape[] | WfShape | null);
      const status = wf?.status ?? "submitted";
      const managerId = wf?.manager_user_id ?? null;
      const isSubmitter = inv.submitter_user_id === userId;
      const isManager = managerId === userId;
      const producer = parseProducerFromServiceDesc(inv.service_description ?? null);
      const isProducer = producerMatches(producer, fullName);

      // Submitter: rejected → resubmit
      if (role === "submitter" && isSubmitter && status === "rejected") {
        guest.pending++;
        continue;
      }
      // Manager: assigned to me + pending_manager
      if (role === "manager" && isManager && status === "pending_manager") {
        guest.pending++;
        continue;
      }
      // Admin/Operations: pending_admin (approve) or ready_for_payment (mark paid)
      if ((role === "admin" || isOperationsRoomMember) && ["approved_by_manager", "pending_admin", "ready_for_payment"].includes(status)) {
        guest.pending++;
        continue;
      }
      // Finance: ready_for_payment
      if (role === "finance" && status === "ready_for_payment") {
        guest.pending++;
        continue;
      }
      // Submitter: own submitted/pending (waiting) - optional, user said "pending tasks"
      // Producer: rejected where they are producer - resubmit? Producers typically don't resubmit, admin does. Skip.
    }

    // Freelancer invoices
    const { data: flInvoices } = await supabase
      .from("invoices")
      .select("id, submitter_user_id, invoice_workflows(status, manager_user_id)")
      .eq("invoice_type", "freelancer");

    for (const inv of flInvoices ?? []) {
      const wf = unwrap(inv.invoice_workflows as WfShape[] | WfShape | null);
      const status = wf?.status ?? "submitted";
      const managerId = wf?.manager_user_id ?? null;
      const isSubmitter = inv.submitter_user_id === userId;
      const isManager = managerId === userId;

      if (role === "submitter" && isSubmitter && status === "rejected") {
        freelancer.pending++;
        continue;
      }
      if (role === "manager" && isManager && status === "pending_manager") {
        freelancer.pending++;
        continue;
      }
      if ((role === "admin" || isOperationsRoomMember) && ["approved_by_manager", "pending_admin", "ready_for_payment"].includes(status)) {
        freelancer.pending++;
        continue;
      }
      if (role === "finance" && status === "ready_for_payment") {
        freelancer.pending++;
        continue;
      }
    }

    // Other invoices - only admin/finance/operations have actions
    if (canSeeOther && (role === "admin" || role === "finance" || role === "operations")) {
      const { data: otherInvoices } = await supabase
        .from("invoices")
        .select("id, invoice_workflows(status)")
        .eq("invoice_type", "other");

      for (const inv of otherInvoices ?? []) {
        const wf = unwrap(inv.invoice_workflows as WfShape[] | WfShape | null);
        const status = wf?.status ?? "submitted";
        if (status === "ready_for_payment") other.pending++;
      }
    }

    let messagesUnread = 0;
    const { count: msgCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null);
    messagesUnread = msgCount ?? 0;

    const totalPending = guest.pending + freelancer.pending + other.pending + messagesUnread;

    return NextResponse.json(
      {
        guest: { pending: guest.pending },
        freelancer: { pending: freelancer.pending },
        other: { pending: other.pending },
        messagesUnread,
        totalPending,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    if ((err as { digest?: string })?.digest === "NEXT_REDIRECT") throw err;
    console.error("My tasks error:", err);
    return NextResponse.json(
      {
        guest: { pending: 0 },
        freelancer: { pending: 0 },
        other: { pending: 0 },
        messagesUnread: 0,
        totalPending: 0,
      },
      { status: 200 }
    );
  }
}
