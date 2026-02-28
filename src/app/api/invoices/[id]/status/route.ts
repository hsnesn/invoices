import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditEvent } from "@/lib/audit";
import {
  sendManagerApprovedEmail,
  sendManagerRejectedEmail,
  sendReadyForPaymentEmail,
  sendPaidEmail,
  sendResubmittedEmail,
} from "@/lib/email";
import { parseGuestNameFromServiceDesc, parseProducerFromServiceDesc } from "@/lib/guest-utils";
import { buildGuestEmailDetails } from "@/lib/guest-email-details";
import { triggerBookingFormWorkflow } from "@/lib/booking-form/approval-trigger";
import { sendBookingFormEmailsForInvoice } from "@/lib/booking-form/process-pending-emails";
import { isEmailStageEnabled, isRecipientEnabled, getFilteredEmailsForUserIds, filterUserIdsByEmailPreference, userWantsUpdateEmails } from "@/lib/email-settings";
import type { InvoiceStatus } from "@/lib/types";
import { notifyWebhooks } from "@/lib/webhook";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = await checkRateLimit(request);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }
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
      .select("submitter_user_id, department_id, program_id, invoice_type, service_description")
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

    const isGuest = (inv as { invoice_type?: string }).invoice_type !== "freelancer";
    const guestName = isGuest ? parseGuestNameFromServiceDesc((inv as { service_description?: string | null }).service_description) : undefined;

    const userId = session.user.id;
    const isOwner = inv.submitter_user_id === userId;
    const isAssigned = wf.manager_user_id === userId;
    const isAdmin = profile.role === "admin";
    const isOperations = profile.role === "operations";
    const isFinance = profile.role === "finance" && ["ready_for_payment", "paid", "archived"].includes(wf.status);

    const { data: orMember } = await supabase
      .from("operations_room_members")
      .select("id")
      .eq("user_id", userId)
      .single();
    const isOperationsRoom = !!orMember;

    // Delegation: backup approver can act when manager is absent (valid date range)
    let isDelegate = false;
    if (wf.manager_user_id) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: delegation } = await supabase
        .from("approval_delegations")
        .select("id")
        .eq("delegator_user_id", wf.manager_user_id)
        .eq("delegate_user_id", userId)
        .lte("valid_from", today)
        .gte("valid_until", today)
        .limit(1)
        .maybeSingle();
      isDelegate = !!delegation;
    }

    if (!isOwner && !isAssigned && !isDelegate && !isAdmin && !isOperations && !isFinance && !isOperationsRoom) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const fromStatus = wf.status;
    const { data: extracted } = await supabase
      .from("invoice_extracted_fields")
      .select("manager_confirmed, invoice_number, beneficiary_name, account_number, sort_code, gross_amount")
      .eq("invoice_id", invoiceId)
      .single();

    const isFreelancer = (inv as { invoice_type?: string }).invoice_type === "freelancer";
    let freelancerDetails: import("@/lib/email").FreelancerEmailDetails | undefined;
    let guestDetails: import("@/lib/email").GuestEmailDetails | undefined;
    if (isFreelancer) {
      const { data: fl } = await supabase
        .from("freelancer_invoice_fields")
        .select("contractor_name, company_name, service_description, service_days_count, service_rate_per_day, service_month, additional_cost")
        .eq("invoice_id", invoiceId)
        .single();
      const deptName = inv.department_id
        ? ((await supabase.from("departments").select("name").eq("id", inv.department_id).single()).data?.name ?? "—")
        : "—";
      freelancerDetails = (await import("@/lib/freelancer-email-details")).buildFreelancerEmailDetails(fl, extracted, deptName);
    } else {
      const deptName = inv.department_id
        ? ((await supabase.from("departments").select("name").eq("id", inv.department_id).single()).data?.name ?? "—")
        : "—";
      const progName = inv.program_id
        ? ((await supabase.from("programs").select("name").eq("id", inv.program_id).single()).data?.name ?? "—")
        : "—";
      guestDetails = buildGuestEmailDetails(
        (inv as { service_description?: string | null }).service_description,
        deptName,
        progName,
        extracted
      );
    }

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
        const newStatus = isFreelancer ? "pending_admin" : "ready_for_payment";

        await supabase
          .from("invoice_workflows")
          .update({
            status: newStatus,
            manager_user_id: session.user.id,
          })
          .eq("invoice_id", invoiceId);

        if (!isFreelancer) {
          const enabled = await isEmailStageEnabled("ready_for_payment");
          if (enabled) {
            const [sendSubmitter, sendFinance] = await Promise.all([
              isRecipientEnabled("ready_for_payment", "submitter"),
              isRecipientEnabled("ready_for_payment", "finance"),
            ]);
            const financeIds = sendFinance ? (await supabase.from("profiles").select("id").eq("role", "finance").eq("is_active", true)).data?.map((p) => p.id) ?? [] : [];
            const financeEmails = sendFinance ? await getFilteredEmailsForUserIds(financeIds) : [];
            const submitterEmails = sendSubmitter ? await getFilteredEmailsForUserIds([inv.submitter_user_id]) : [];
            const submitterEmail = submitterEmails[0] ?? "";
            if (submitterEmail || financeEmails.length > 0) {
              await sendReadyForPaymentEmail({
                submitterEmail,
                financeEmails,
                invoiceId,
                invoiceNumber: extracted?.invoice_number ?? undefined,
                guestName,
                guestDetails,
              });
            }
          }
        }

        if (isFreelancer) {
          const approverUser = (await supabase.auth.admin.getUserById(session.user.id)).data?.user;
          const approverProfile = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
          const approvedAt = new Date();

          const managerApprovedEnabled = await isEmailStageEnabled("manager_approved");
          if (managerApprovedEnabled) {
            const [sendSubmitter, sendAdmin, sendOps] = await Promise.all([
              isRecipientEnabled("manager_approved", "submitter"),
              isRecipientEnabled("manager_approved", "admin"),
              isRecipientEnabled("manager_approved", "operations"),
            ]);
            const adminIds = sendAdmin ? (await supabase.from("profiles").select("id").eq("role", "admin").eq("is_active", true)).data?.map((p) => p.id) ?? [] : [];
            const orUserIds = sendOps ? (await supabase.from("operations_room_members").select("user_id")).data?.map((m) => m.user_id) ?? [] : [];
            const adminEmails = sendAdmin ? await getFilteredEmailsForUserIds(adminIds) : [];
            const operationsRoomEmails = sendOps ? await getFilteredEmailsForUserIds(orUserIds) : [];
            const submitterEmails = sendSubmitter ? await getFilteredEmailsForUserIds([inv.submitter_user_id]) : [];
            const submitterEmail = submitterEmails[0] ?? "";
            if (submitterEmail || adminEmails.length > 0 || operationsRoomEmails.length > 0) {
              const emailResult = await sendManagerApprovedEmail({
                submitterEmail,
                adminEmails,
                operationsRoomEmails,
                invoiceId,
                invoiceNumber: extracted?.invoice_number ?? undefined,
                managerName: approverProfile.data?.full_name ?? undefined,
                freelancerDetails,
              });
              if (!emailResult.success) console.error("[ManagerApproved] Email failed:", emailResult.error);
            }
          }

          // Form created first, then send booking form emails immediately (to approver + London Operations)
          const bfResult = await triggerBookingFormWorkflow(supabase, {
            invoiceId,
            approverUserId: session.user.id,
            approverName: approverProfile.data?.full_name ?? "Approver",
            approverEmail: approverUser?.email ?? "",
            approvedAt,
          });
          if (!bfResult.ok && !bfResult.skipped) console.error("[BookingForm] Workflow failed:", bfResult.error);
          if (bfResult.ok && !bfResult.skipped) {
            const sendResult = await sendBookingFormEmailsForInvoice(supabase, invoiceId);
            if (!sendResult.ok) console.error("[BookingForm] Email send failed:", sendResult.error);
          }
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

        const enabled = await isEmailStageEnabled("manager_rejected");
        if (enabled) {
          const sendSubmitter = await isRecipientEnabled("manager_rejected", "submitter");
          if (sendSubmitter) {
            const submitterEmails = await getFilteredEmailsForUserIds([inv.submitter_user_id]);
            const submitterEmail = submitterEmails[0];
            if (submitterEmail) {
              await sendManagerRejectedEmail({
                submitterEmail,
                invoiceId,
                reason: rejection_reason,
                invoiceNumber: extracted?.invoice_number ?? undefined,
                guestName,
                guestDetails,
                freelancerDetails,
              });
            }
          }
        }
      } else {
        return NextResponse.json({ error: "Invalid manager action" }, { status: 400 });
      }
    } else if ((isOperationsRoom || isOperations) && (inv as { invoice_type?: string }).invoice_type === "freelancer") {
      const opsValidFrom = ["pending_admin", "approved_by_manager"];
      if (to_status === "ready_for_payment" && opsValidFrom.includes(fromStatus)) {
        await supabase
          .from("invoice_workflows")
          .update({
            status: "ready_for_payment",
            admin_comment: admin_comment ?? wf.admin_comment,
          })
          .eq("invoice_id", invoiceId);

        const enabled = await isEmailStageEnabled("ready_for_payment");
        if (enabled) {
          const [sendSubmitter, sendFinance] = await Promise.all([
            isRecipientEnabled("ready_for_payment", "submitter"),
            isRecipientEnabled("ready_for_payment", "finance"),
          ]);
          const financeIds = sendFinance ? (await supabase.from("profiles").select("id").eq("role", "finance").eq("is_active", true)).data?.map((p) => p.id) ?? [] : [];
          const financeEmails = sendFinance ? await getFilteredEmailsForUserIds(financeIds) : [];
          const submitterEmails = sendSubmitter ? await getFilteredEmailsForUserIds([inv.submitter_user_id]) : [];
          const submitterEmail = submitterEmails[0] ?? "";
          if (submitterEmail || financeEmails.length > 0) {
            await sendReadyForPaymentEmail({
              submitterEmail,
              financeEmails,
              invoiceId,
              invoiceNumber: extracted?.invoice_number ?? undefined,
              freelancerDetails,
            });
          }
        }
      } else if (to_status === "rejected" && opsValidFrom.includes(fromStatus)) {
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

        if (await isEmailStageEnabled("manager_rejected")) {
          const sendSubmitter = await isRecipientEnabled("manager_rejected", "submitter");
          if (sendSubmitter) {
            const submitterEmails = await getFilteredEmailsForUserIds([inv.submitter_user_id]);
            const submitterEmail = submitterEmails[0];
            if (submitterEmail) {
              await sendManagerRejectedEmail({
                submitterEmail,
                invoiceId,
                reason: rejection_reason,
                invoiceNumber: extracted?.invoice_number ?? undefined,
                guestDetails,
                freelancerDetails,
              });
            }
          }
        }
      } else {
        return NextResponse.json({ error: "Operations Room can only approve or reject invoices in The Operations Room stage" }, { status: 400 });
      }
    } else if (profile.role === "admin") {
      if (to_status === "approved_by_manager") {
        if (fromStatus !== "pending_manager") {
          return NextResponse.json(
            { error: "Invalid transition" },
            { status: 400 }
          );
        }
        const invIsFreelancer = (inv as { invoice_type?: string }).invoice_type === "freelancer";
        await supabase
          .from("invoice_workflows")
          .update({
            status: invIsFreelancer ? "pending_admin" : "ready_for_payment",
            manager_user_id: session.user.id,
          })
          .eq("invoice_id", invoiceId);

        if (invIsFreelancer) {
          const approverUser = (await supabase.auth.admin.getUserById(session.user.id)).data?.user;
          const approverProfile = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
          const approvedAt = new Date();

          const managerApprovedEnabled = await isEmailStageEnabled("manager_approved");
          if (managerApprovedEnabled) {
            const [sendSubmitter, sendAdmin, sendOps] = await Promise.all([
              isRecipientEnabled("manager_approved", "submitter"),
              isRecipientEnabled("manager_approved", "admin"),
              isRecipientEnabled("manager_approved", "operations"),
            ]);
            const adminIds = sendAdmin ? (await supabase.from("profiles").select("id").eq("role", "admin").eq("is_active", true)).data?.map((p) => p.id) ?? [] : [];
            const orUserIds = sendOps ? (await supabase.from("operations_room_members").select("user_id")).data?.map((m) => m.user_id) ?? [] : [];
            const adminEmails = sendAdmin ? await getFilteredEmailsForUserIds(adminIds) : [];
            const operationsRoomEmails = sendOps ? await getFilteredEmailsForUserIds(orUserIds) : [];
            const submitterEmails = sendSubmitter ? await getFilteredEmailsForUserIds([inv.submitter_user_id]) : [];
            const submitterEmail = submitterEmails[0] ?? "";
            if (submitterEmail || adminEmails.length > 0 || operationsRoomEmails.length > 0) {
              const emailResult = await sendManagerApprovedEmail({
                submitterEmail,
                adminEmails,
                operationsRoomEmails,
                invoiceId,
                invoiceNumber: extracted?.invoice_number ?? undefined,
                managerName: approverProfile.data?.full_name ?? undefined,
                freelancerDetails,
              });
              if (!emailResult.success) console.error("[ManagerApproved] Email failed:", emailResult.error);
            }
          }

          const bfResult = await triggerBookingFormWorkflow(supabase, {
            invoiceId,
            approverUserId: session.user.id,
            approverName: approverProfile.data?.full_name ?? "Approver",
            approverEmail: approverUser?.email ?? "",
            approvedAt,
          });
          if (!bfResult.ok && !bfResult.skipped) console.error("[BookingForm] Workflow failed:", bfResult.error);
          if (bfResult.ok && !bfResult.skipped) {
            const sendResult = await sendBookingFormEmailsForInvoice(supabase, invoiceId);
            if (!sendResult.ok) console.error("[BookingForm] Email send failed:", sendResult.error);
          }
        }
      } else if (to_status === "ready_for_payment") {
        const validFrom = ["pending_manager", "approved_by_manager", "pending_admin"];
        const adminCanForce = profile.role === "admin";
        if (!adminCanForce && !validFrom.includes(fromStatus)) {
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

        if (await isEmailStageEnabled("ready_for_payment")) {
          const [sendSubmitter, sendFinance] = await Promise.all([
            isRecipientEnabled("ready_for_payment", "submitter"),
            isRecipientEnabled("ready_for_payment", "finance"),
          ]);
          const financeIds = sendFinance ? (await supabase.from("profiles").select("id").eq("role", "finance").eq("is_active", true)).data?.map((p) => p.id) ?? [] : [];
          const filteredFinanceIds = sendFinance ? await filterUserIdsByEmailPreference(financeIds) : [];
          const financeEmails: string[] = [];
          for (const id of filteredFinanceIds) {
            const u = (await supabase.auth.admin.getUserById(id)).data?.user;
            if (u?.email) financeEmails.push(u.email);
          }
          const submitterUser = sendSubmitter ? (await supabase.auth.admin.getUserById(inv.submitter_user_id)).data?.user : null;
          const submitterWants = sendSubmitter && submitterUser?.email && (await userWantsUpdateEmails(inv.submitter_user_id));
          if (submitterWants || financeEmails.length > 0) {
            await sendReadyForPaymentEmail({
              submitterEmail: submitterWants ? submitterUser!.email! : "",
              financeEmails,
              invoiceId,
              invoiceNumber: extracted?.invoice_number ?? undefined,
              guestName,
              guestDetails,
              freelancerDetails,
            });
          }
        }

        // Booking form: when admin approves freelancer directly from pending_manager (skips manager step)
        if ((inv as { invoice_type?: string }).invoice_type === "freelancer" && fromStatus === "pending_manager") {
          const approverUser = (await supabase.auth.admin.getUserById(session.user.id)).data?.user;
          const approverProfile = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
          const approvedAt = new Date();
          const bfResult = await triggerBookingFormWorkflow(supabase, {
            invoiceId,
            approverUserId: session.user.id,
            approverName: approverProfile.data?.full_name ?? "Admin",
            approverEmail: approverUser?.email ?? "",
            approvedAt,
          });
          if (!bfResult.ok && !bfResult.skipped) console.error("[BookingForm] Workflow failed:", bfResult.error);
          if (bfResult.ok && !bfResult.skipped) {
            const sendResult = await sendBookingFormEmailsForInvoice(supabase, invoiceId);
            if (!sendResult.ok) console.error("[BookingForm] Email send failed:", sendResult.error);
          }
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

        if (await isEmailStageEnabled("manager_rejected")) {
          const sendSubmitter = await isRecipientEnabled("manager_rejected", "submitter");
          if (sendSubmitter) {
            const submitterUser = (await supabase.auth.admin.getUserById(inv.submitter_user_id)).data?.user;
            const submitterWants = submitterUser?.email && (await userWantsUpdateEmails(inv.submitter_user_id));
            if (submitterWants) {
              await sendManagerRejectedEmail({
                submitterEmail: submitterUser!.email!,
                invoiceId,
                reason: rejection_reason!,
                invoiceNumber: extracted?.invoice_number ?? undefined,
                managerName: profile.full_name ?? undefined,
                guestName,
                guestDetails,
                freelancerDetails,
              });
            }
          }
        }
      } else if (to_status === "paid") {
        const adminCanForce = profile.role === "admin";
        if (!adminCanForce && fromStatus !== "ready_for_payment") {
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

        if (await isEmailStageEnabled("paid")) {
          const invIsGuest = (inv as { invoice_type?: string }).invoice_type !== "freelancer";
          const [sendSubmitter, sendAdmin, sendProducers] = await Promise.all([
            isRecipientEnabled("paid", "submitter"),
            isRecipientEnabled("paid", "admin"),
            isRecipientEnabled("paid", "producers"),
          ]);
          let paidSubmitterEmail = "";
          let paidAdminEmails: string[] = [];
          if (invIsGuest) {
            if (sendProducers) {
              const producerName = parseProducerFromServiceDesc((inv as { service_description?: string | null }).service_description);
              if (producerName) {
                const { data: producerProfiles } = await supabase
                  .from("profiles")
                  .select("id")
                  .ilike("full_name", producerName.trim())
                  .eq("is_active", true);
                const producerIds = producerProfiles?.map((p) => p.id) ?? [];
                const filteredIds = await filterUserIdsByEmailPreference(producerIds);
                for (const id of filteredIds) {
                  const u = (await supabase.auth.admin.getUserById(id)).data?.user;
                  if (u?.email && (await userWantsUpdateEmails(id))) paidAdminEmails.push(u.email);
                }
              }
            }
          } else {
            if (sendSubmitter) {
              const paidSubUser = (await supabase.auth.admin.getUserById(inv.submitter_user_id)).data?.user;
              const submitterWants = paidSubUser?.email && (await userWantsUpdateEmails(inv.submitter_user_id));
              paidSubmitterEmail = submitterWants ? paidSubUser!.email! : "";
            }
            if (sendAdmin) {
              const paidAdminIds = (await supabase.from("profiles").select("id").eq("role", "admin").eq("is_active", true)).data?.map((p) => p.id) ?? [];
              const filteredAdminIds = await filterUserIdsByEmailPreference(paidAdminIds);
              for (const id of filteredAdminIds) { const u = (await supabase.auth.admin.getUserById(id)).data?.user; if (u?.email) paidAdminEmails.push(u.email); }
            }
          }
          if (paidSubmitterEmail || paidAdminEmails.length > 0) {
            await sendPaidEmail({ submitterEmail: paidSubmitterEmail, adminEmails: paidAdminEmails, invoiceId, paymentReference: payment_reference, invoiceNumber: extracted?.invoice_number ?? undefined, guestName, guestDetails, freelancerDetails });
          }
        }
      } else if (to_status === "archived") {
        await supabase
          .from("invoice_workflows")
          .update({ status: "archived" })
          .eq("invoice_id", invoiceId);
      } else if (to_status === "pending_admin") {
        const validFrom = ["ready_for_payment"];
        const adminCanForce = profile.role === "admin";
        if (!adminCanForce && !validFrom.includes(fromStatus)) {
          return NextResponse.json(
            { error: "Invalid transition to pending_admin" },
            { status: 400 }
          );
        }
        if ((inv as { invoice_type?: string }).invoice_type !== "freelancer") {
          return NextResponse.json(
            { error: "pending_admin is only for freelancer invoices" },
            { status: 400 }
          );
        }
        await supabase
          .from("invoice_workflows")
          .update({ status: "pending_admin" })
          .eq("invoice_id", invoiceId);
      } else if (to_status === "pending_manager") {
        const validFromForResubmit = ["rejected"];
        const validFromForMoveBack = ["ready_for_payment", "approved_by_manager", "pending_admin", "paid", "archived", "submitted"];
        const adminCanForce = profile.role === "admin";
        const isValid = validFromForResubmit.includes(fromStatus) || validFromForMoveBack.includes(fromStatus);
        if (!adminCanForce && !isValid) {
          return NextResponse.json(
            { error: "Invalid transition to pending_manager" },
            { status: 400 }
          );
        }
        const today = new Date().toISOString().slice(0, 10);
        await supabase
          .from("invoice_workflows")
          .update({
            status: "pending_manager",
            pending_manager_since: today,
            ...(fromStatus === "rejected" ? { rejection_reason: null } : {}),
          })
          .eq("invoice_id", invoiceId);

        if (fromStatus === "rejected") {
          if (await isEmailStageEnabled("resubmitted")) {
            const sendDeptEp = await isRecipientEnabled("resubmitted", "dept_ep");
            if (sendDeptEp) {
              const deptEpId = wf.manager_user_id;
              const managerEmails: string[] = [];
              if (deptEpId) {
                const filteredIds = await filterUserIdsByEmailPreference([deptEpId]);
                for (const id of filteredIds) { const u = (await supabase.auth.admin.getUserById(id)).data?.user; if (u?.email) managerEmails.push(u.email); }
              }
              if (managerEmails.length > 0) {
                await sendResubmittedEmail({ managerEmails, invoiceId, invoiceNumber: extracted?.invoice_number ?? undefined, submitterName: profile.full_name ?? undefined, guestName, guestDetails, freelancerDetails });
              }
            }
          }
        }
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

        const isGuestInvoice = (inv as { invoice_type?: string }).invoice_type !== "freelancer";
        if (await isEmailStageEnabled("paid")) {
          const [sendSubmitter, sendAdmin, sendProducers] = await Promise.all([
            isRecipientEnabled("paid", "submitter"),
            isRecipientEnabled("paid", "admin"),
            isRecipientEnabled("paid", "producers"),
          ]);
          let submitterEmail = "";
          let adminEmails: string[] = [];
          if (isGuestInvoice) {
            if (sendProducers) {
              const producerName = parseProducerFromServiceDesc((inv as { service_description?: string | null }).service_description);
              if (producerName) {
                const { data: producerProfiles } = await supabase
                  .from("profiles")
                  .select("id")
                  .ilike("full_name", producerName.trim())
                  .eq("is_active", true);
                const producerIds = producerProfiles?.map((p) => p.id) ?? [];
                const filteredIds = await filterUserIdsByEmailPreference(producerIds);
                for (const id of filteredIds) {
                  const u = (await supabase.auth.admin.getUserById(id)).data?.user;
                  if (u?.email && (await userWantsUpdateEmails(id))) adminEmails.push(u.email);
                }
              }
            }
          } else {
            if (sendSubmitter) {
              const submitterUser = (await supabase.auth.admin.getUserById(inv.submitter_user_id)).data?.user;
              const submitterWants = submitterUser?.email && (await userWantsUpdateEmails(inv.submitter_user_id));
              submitterEmail = submitterWants ? submitterUser!.email! : "";
            }
            if (sendAdmin) {
              const adminIds = (await supabase.from("profiles").select("id").eq("role", "admin").eq("is_active", true)).data?.map((p) => p.id) ?? [];
              const filteredAdminIds = await filterUserIdsByEmailPreference(adminIds);
              for (const id of filteredAdminIds) {
                const u = (await supabase.auth.admin.getUserById(id)).data?.user;
                if (u?.email) adminEmails.push(u.email);
              }
            }
          }
          if (submitterEmail || adminEmails.length > 0) {
            await sendPaidEmail({
              submitterEmail,
              adminEmails,
              invoiceId,
              paymentReference: payment_reference,
              invoiceNumber: extracted?.invoice_number ?? undefined,
              guestName,
              guestDetails,
              freelancerDetails,
            });
          }
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
    } else if ((profile.role === "submitter" || isOwner) && profile.role !== "viewer") {
      if (to_status === "pending_manager" && fromStatus === "rejected") {
        const today = new Date().toISOString().slice(0, 10);
        await supabase
          .from("invoice_workflows")
          .update({
            status: "pending_manager",
            pending_manager_since: today,
            rejection_reason: null,
          })
          .eq("invoice_id", invoiceId);

        if (await isEmailStageEnabled("resubmitted")) {
          const sendDeptEp = await isRecipientEnabled("resubmitted", "dept_ep");
          if (sendDeptEp) {
            const deptEpId = wf.manager_user_id;
            const resubManagerEmails: string[] = [];
            if (deptEpId) {
              const filteredIds = await filterUserIdsByEmailPreference([deptEpId]);
              for (const id of filteredIds) { const u = (await supabase.auth.admin.getUserById(id)).data?.user; if (u?.email) resubManagerEmails.push(u.email); }
            }
            if (resubManagerEmails.length > 0) {
              await sendResubmittedEmail({ managerEmails: resubManagerEmails, invoiceId, invoiceNumber: extracted?.invoice_number ?? undefined, submitterName: profile.full_name ?? undefined, guestName, guestDetails, freelancerDetails });
            }
          }
        }
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
