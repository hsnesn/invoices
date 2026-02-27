import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type WfShape = { status: string; rejection_reason: string | null; manager_user_id: string | null; paid_date: string | null; created_at?: string; updated_at?: string };
type ExtShape = { gross_amount: number | null };
type FlShape = {
  contractor_name: string | null; service_description: string | null;
  service_days_count: number | null; service_rate_per_day: number | null;
  additional_cost: number | null; booked_by: string | null; service_month: string | null;
};

function unwrap<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function parseServiceDesc(val: string | null): Record<string, string> {
  if (!val) return {};
  const out: Record<string, string> = {};
  for (const line of val.split("\n")) {
    const l = line.trim(); if (!l) continue;
    const sep = l.includes(":") ? ":" : l.includes("-") ? "-" : null;
    if (!sep) continue;
    const idx = l.indexOf(sep); if (idx === -1) continue;
    const key = l.slice(0, idx).trim().toLowerCase().replace(/\s+/g, " ");
    const v = l.slice(idx + 1).trim();
    if (key) out[key] = v;
  }
  return out;
}

function fromAliases(meta: Record<string, string>, aliases: string[], fb = "—") {
  for (const k of aliases) { const v = meta[k]; if (v?.trim()) return v.trim(); }
  return fb;
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

function canUserSeeGuestInvoice(
  inv: { submitter_user_id: string; department_id: string | null; program_id: string | null; service_description?: string | null; invoice_workflows: WfShape[] | WfShape | null },
  userId: string,
  role: string,
  userFullName: string | null
): boolean {
  if (role === "admin" || role === "viewer" || role === "operations") return true;
  if (inv.submitter_user_id === userId) return true;
  if (userFullName) {
    const producer = parseProducerFromServiceDesc(inv.service_description ?? null);
    if (producer && producer.trim().toLowerCase() === userFullName.trim().toLowerCase()) return true;
  }
  const wf = unwrap(inv.invoice_workflows);
  if (role === "manager") return wf?.manager_user_id === userId;
  if (role === "finance") return ["ready_for_payment", "paid", "archived"].includes(wf?.status ?? "");
  return false;
}

function canUserSeeFreelancerInvoice(
  inv: { submitter_user_id: string; department_id: string | null; program_id: string | null; invoice_workflows: WfShape[] | WfShape | null },
  userId: string,
  role: string,
  isOperationsRoomMember: boolean
): boolean {
  if (role === "admin" || role === "viewer" || role === "operations") return true;
  if (isOperationsRoomMember) return true;
  if (inv.submitter_user_id === userId) return true;
  const wf = unwrap(inv.invoice_workflows);
  if (role === "manager") return wf?.manager_user_id === userId;
  if (role === "finance") return ["ready_for_payment", "paid", "archived"].includes(wf?.status ?? "");
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const body = await req.json();
    const { type, year, month, quarter, invoiceType, dateFrom, dateTo } = body as {
      type: "monthly" | "quarterly" | "department" | "custom";
      year?: number; month?: number; quarter?: number;
      invoiceType?: "guest" | "freelancer" | "all";
      dateFrom?: string; dateTo?: string;
    };

    const supabase = createAdminClient();
    const invType = invoiceType ?? "all";

    const { data: orMembers } = await supabase
      .from("operations_room_members")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    const isOperationsRoomMember = !!orMembers || profile.role === "operations";

    let query = supabase.from("invoices").select(`
      id, created_at, department_id, program_id, submitter_user_id, invoice_type, service_description,
      invoice_workflows(status, rejection_reason, manager_user_id, paid_date, created_at, updated_at),
      invoice_extracted_fields(gross_amount),
      freelancer_invoice_fields(contractor_name, service_description, service_days_count, service_rate_per_day, additional_cost, booked_by, service_month)
    `).order("created_at", { ascending: false });

    if (invType !== "all") query = query.eq("invoice_type", invType);

    const { data: invoicesRaw } = await query;
    const rawInvoices = invoicesRaw ?? [];

    const allInvoices = rawInvoices.filter((inv) => {
      const isGuest = inv.invoice_type === "guest" || inv.invoice_type === "salary";
      const isFl = inv.invoice_type === "freelancer";
      if (isGuest) return canUserSeeGuestInvoice(inv as never, session.user.id, profile.role, profile.full_name ?? null);
      if (isFl) return canUserSeeFreelancerInvoice(inv as never, session.user.id, profile.role, isOperationsRoomMember);
      return true;
    });

    const { data: departments } = await supabase.from("departments").select("id,name");
    const deptMap = Object.fromEntries((departments ?? []).map((d: { id: string; name: string }) => [d.id, d.name]));

    const { data: profiles } = await supabase.from("profiles").select("id,full_name");
    const profMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? p.id]));

    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetQuarter = quarter ?? Math.ceil(targetMonth / 3);

    const filterByPeriod = (inv: { created_at: string }) => {
      if (type === "custom" && dateFrom && dateTo) {
        return inv.created_at >= dateFrom && inv.created_at <= dateTo + "T23:59:59";
      }
      const d = new Date(inv.created_at);
      const y = d.getFullYear(); const m = d.getMonth() + 1;
      if (type === "monthly") return y === targetYear && m === targetMonth;
      if (type === "quarterly") return y === targetYear && Math.ceil(m / 3) === targetQuarter;
      return y === targetYear;
    };

    const filtered = allInvoices.filter(filterByPeriod);

    const processRow = (inv: typeof allInvoices[number]) => {
      const wf = unwrap(inv.invoice_workflows as WfShape[] | WfShape | null);
      const ext = unwrap(inv.invoice_extracted_fields as ExtShape[] | ExtShape | null);
      const fl = unwrap(inv.freelancer_invoice_fields as FlShape[] | FlShape | null);
      const status = wf?.status ?? "submitted";
      const isFreelancer = inv.invoice_type === "freelancer";
      const daysCount = fl?.service_days_count ?? 0;
      const rate = fl?.service_rate_per_day ?? 0;
      const addCost = fl?.additional_cost ?? 0;
      const amount = isFreelancer ? daysCount * rate + addCost : (ext?.gross_amount ?? 0);
      const meta = parseServiceDesc(inv.service_description);
      const producer = isFreelancer ? "—" : fromAliases(meta, ["producer", "producer name", "prod"]);
      const paymentType = isFreelancer ? "—" : fromAliases(meta, ["payment type", "payment_type"], "paid guest").replace(/_/g, " ");
      const guest = isFreelancer ? (fl?.contractor_name ?? "—") : fromAliases(meta, ["guest name", "guest", "guest_name"]);
      const rejectionReason = wf?.rejection_reason ?? null;
      const paidDate = wf?.paid_date ?? null;
      const serviceDesc = fl?.service_description ?? "—";
      const bookedBy = fl?.booked_by ?? "—";

      return { id: inv.id, createdAt: inv.created_at, type: inv.invoice_type, status, amount, department: inv.department_id ? deptMap[inv.department_id] ?? "Unknown" : "N/A", submitter: profMap[inv.submitter_user_id] ?? "Unknown", contractor: fl?.contractor_name ?? "—", paidDate, producer, paymentType, guest, rejectionReason, serviceDesc, bookedBy };
    };

    const processed = filtered.map(processRow);
    const totalInvoices = processed.length;
    const totalAmount = processed.reduce((s, r) => s + r.amount, 0);
    const paidInvoices = processed.filter(r => r.status === "paid" || r.status === "archived");
    const paidAmount = paidInvoices.reduce((s, r) => s + r.amount, 0);
    const pendingAmount = totalAmount - paidAmount;
    const rejectedCount = processed.filter(r => r.status === "rejected").length;

    // By department
    const byDepartment: Record<string, { count: number; amount: number }> = {};
    for (const r of processed) { const d = r.department; if (!byDepartment[d]) byDepartment[d] = { count: 0, amount: 0 }; byDepartment[d].count++; byDepartment[d].amount += r.amount; }

    // By status
    const byStatus: Record<string, number> = {};
    for (const r of processed) { byStatus[r.status] = (byStatus[r.status] ?? 0) + 1; }

    // By producer (guest only)
    const byProducer: Record<string, { count: number; amount: number; paidCount: number; paidAmount: number; unpaidCount: number; unpaidAmount: number }> = {};
    for (const r of processed) {
      if (r.producer === "—" || r.type === "freelancer") continue;
      if (!byProducer[r.producer]) byProducer[r.producer] = { count: 0, amount: 0, paidCount: 0, paidAmount: 0, unpaidCount: 0, unpaidAmount: 0 };
      const p = byProducer[r.producer]; p.count++; p.amount += r.amount;
      const isPaid = r.paymentType.toLowerCase().includes("paid") && !r.paymentType.toLowerCase().includes("unpaid");
      if (isPaid) { p.paidCount++; p.paidAmount += r.amount; } else { p.unpaidCount++; p.unpaidAmount += r.amount; }
    }

    // By payment type (guest only)
    const byPaymentType: Record<string, { count: number; amount: number }> = {};
    for (const r of processed) { if (r.type === "freelancer") continue; const pt = r.paymentType.toLowerCase().includes("unpaid") ? "Unpaid Guest" : "Paid Guest"; if (!byPaymentType[pt]) byPaymentType[pt] = { count: 0, amount: 0 }; byPaymentType[pt].count++; byPaymentType[pt].amount += r.amount; }

    // Monthly trend (all invoices in year, not just filtered period)
    const monthlyTrend: { month: string; count: number; amount: number }[] = [];
    const yearInvoices = allInvoices.filter(inv => { const d = new Date(inv.created_at); return d.getFullYear() === targetYear; });
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let m = 0; m < 12; m++) {
      const mInvs = yearInvoices.filter(inv => new Date(inv.created_at).getMonth() === m).map(processRow);
      monthlyTrend.push({ month: monthNames[m], count: mInvs.length, amount: mInvs.reduce((s, r) => s + r.amount, 0) });
    }

    // Year-over-year
    const prevYearInvoices = allInvoices.filter(inv => new Date(inv.created_at).getFullYear() === targetYear - 1).map(processRow);
    const thisYearAll = yearInvoices.map(processRow);
    const yoy = {
      thisYear: { year: targetYear, count: thisYearAll.length, amount: thisYearAll.reduce((s, r) => s + r.amount, 0) },
      lastYear: { year: targetYear - 1, count: prevYearInvoices.length, amount: prevYearInvoices.reduce((s, r) => s + r.amount, 0) },
    };

    // Average processing time (submission to paid, in days)
    const processingTimes: number[] = [];
    for (const inv of filtered) {
      const wf = unwrap(inv.invoice_workflows as WfShape[] | WfShape | null);
      if (wf?.paid_date) {
        const submitted = new Date(inv.created_at).getTime();
        const paid = new Date(wf.paid_date).getTime();
        const days = Math.max(0, Math.round((paid - submitted) / 86400000));
        processingTimes.push(days);
      }
    }
    const avgProcessingDays = processingTimes.length > 0 ? Math.round(processingTimes.reduce((s, d) => s + d, 0) / processingTimes.length) : null;
    const minProcessingDays = processingTimes.length > 0 ? Math.min(...processingTimes) : null;
    const maxProcessingDays = processingTimes.length > 0 ? Math.max(...processingTimes) : null;

    // Top guests only (exclude freelancers - they have their own Contractor tab)
    const topGuests: Record<string, { count: number; amount: number }> = {};
    for (const r of processed) {
      if (r.type === "freelancer") continue;
      const name = r.guest;
      if (name === "—") continue;
      if (!topGuests[name]) topGuests[name] = { count: 0, amount: 0 };
      topGuests[name].count++;
      topGuests[name].amount += r.amount;
    }

    // Rejection analysis
    const rejectionsByProducer: Record<string, number> = {};
    const rejectionsByDept: Record<string, number> = {};
    const rejectionReasons: Record<string, number> = {};
    for (const r of processed) {
      if (r.status !== "rejected") continue;
      if (r.producer !== "—") rejectionsByProducer[r.producer] = (rejectionsByProducer[r.producer] ?? 0) + 1;
      if (r.department !== "N/A") rejectionsByDept[r.department] = (rejectionsByDept[r.department] ?? 0) + 1;
      const reason = r.rejectionReason?.trim() || "No reason given";
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
    }

    // Freelancer-specific
    const flRows = processed.filter(r => r.type === "freelancer");
    const byContractor: Record<string, { count: number; amount: number }> = {};
    const byServiceDesc: Record<string, { count: number; amount: number }> = {};
    const byBookedBy: Record<string, { count: number; amount: number }> = {};
    for (const r of flRows) {
      if (r.contractor !== "—") { if (!byContractor[r.contractor]) byContractor[r.contractor] = { count: 0, amount: 0 }; byContractor[r.contractor].count++; byContractor[r.contractor].amount += r.amount; }
      if (r.serviceDesc !== "—") { if (!byServiceDesc[r.serviceDesc]) byServiceDesc[r.serviceDesc] = { count: 0, amount: 0 }; byServiceDesc[r.serviceDesc].count++; byServiceDesc[r.serviceDesc].amount += r.amount; }
      if (r.bookedBy !== "—") { if (!byBookedBy[r.bookedBy]) byBookedBy[r.bookedBy] = { count: 0, amount: 0 }; byBookedBy[r.bookedBy].count++; byBookedBy[r.bookedBy].amount += r.amount; }
    }

    const periodLabel = type === "custom" ? `${dateFrom ?? ""} — ${dateTo ?? ""}`
      : type === "monthly" ? `${new Date(targetYear, targetMonth - 1).toLocaleString("en-GB", { month: "long" })} ${targetYear}`
      : type === "quarterly" ? `Q${targetQuarter} ${targetYear}` : `${targetYear}`;

    const report = {
      period: periodLabel, type, invoiceType: invType,
      summary: { totalInvoices, totalAmount, paidInvoices: paidInvoices.length, paidAmount, pendingAmount, rejectedCount },
      byDepartment, byStatus, byProducer, byPaymentType,
      monthlyTrend, yoy,
      processing: { avg: avgProcessingDays, min: minProcessingDays, max: maxProcessingDays, count: processingTimes.length },
      topGuests,
      rejections: { byProducer: rejectionsByProducer, byDepartment: rejectionsByDept, reasons: rejectionReasons },
      freelancer: { byContractor, byServiceDesc, byBookedBy, total: flRows.length, totalAmount: flRows.reduce((s, r) => s + r.amount, 0) },
      generatedAt: new Date().toISOString(),
    };

    if (body.sendEmail && body.emailTo) {
      const { sendEmail } = await import("@/lib/email");
      const deptRows = Object.entries(byDepartment).sort((a, b) => b[1].amount - a[1].amount).map(([dept, { count, amount }]) => `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb">${dept}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;text-align:right">${count}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;text-align:right">£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td></tr>`).join("");
      const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e293b">${invType === "all" ? "All" : invType.charAt(0).toUpperCase() + invType.slice(1)} Invoice Report — ${periodLabel}</h2><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px 12px;font-weight:bold;background:#f8fafc">Total Invoices</td><td style="padding:8px 12px;text-align:right">${totalInvoices}</td></tr><tr><td style="padding:8px 12px;font-weight:bold;background:#f8fafc">Total Amount</td><td style="padding:8px 12px;text-align:right">£${totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td></tr><tr><td style="padding:8px 12px;font-weight:bold;background:#f8fafc">Paid</td><td style="padding:8px 12px;text-align:right">${paidInvoices.length} (£${paidAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })})</td></tr><tr><td style="padding:8px 12px;font-weight:bold;background:#f8fafc">Avg Processing</td><td style="padding:8px 12px;text-align:right">${avgProcessingDays ?? "N/A"} days</td></tr></table><h3 style="color:#1e293b;margin-top:24px">Department Breakdown</h3><table style="width:100%;border-collapse:collapse;margin:8px 0"><thead><tr><th style="padding:8px 12px;text-align:left;background:#3b82f6;color:white">Department</th><th style="padding:8px 12px;text-align:right;background:#3b82f6;color:white">Count</th><th style="padding:8px 12px;text-align:right;background:#3b82f6;color:white">Amount</th></tr></thead><tbody>${deptRows}</tbody></table><p style="color:#94a3b8;font-size:12px;margin-top:24px">Generated: ${new Date().toLocaleString("en-GB")}</p></div>`;
      const result = await sendEmail({ to: body.emailTo, subject: `Invoice Report — ${periodLabel}`, html });
      if (result.success) {
        return NextResponse.json({ ...report, emailSent: true });
      }
      const errMsg = typeof result.error === "object" ? JSON.stringify(result.error) : String(result.error);
      return NextResponse.json({ ...report, emailSent: false, emailError: errMsg });
    }

    return NextResponse.json(report);
  } catch (err) {
    if ((err as { digest?: string })?.digest === "NEXT_REDIRECT") throw err;
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
