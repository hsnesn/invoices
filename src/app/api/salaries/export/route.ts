import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

/** GET /api/salaries/export - Export salaries as Excel (admin, operations, finance) */
export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "finance") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const supabase = createAdminClient();
    let query = supabase
      .from("salaries")
      .select("*, employees(full_name, email_address)")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (month) query = query.eq("payment_month", month);
    if (year) query = query.eq("payment_year", parseInt(year, 10));

    const { data: salaries, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (salaries ?? []).map((s) => {
      const emp = s.employees as { full_name?: string; email_address?: string } | null;
      return {
        ID: s.display_id ?? "",
        "Employee Name": s.employee_name ?? "",
        "NI Number": s.ni_number ?? "",
        "Net Pay": s.net_pay ?? "",
        "Gross Pay": s.total_gross_pay ?? "",
        "PAYE Tax": s.paye_tax ?? "",
        "Employee NI": s.employee_ni ?? "",
        "Employee Pension": s.employee_pension ?? "",
        "Employer Pension": s.employer_pension ?? "",
        "Employer Total Cost": s.employer_total_cost ?? "",
        "Sort Code": s.sort_code ?? "",
        "Account Number": s.bank_account_number ?? "",
        "Payment Month": s.payment_month ?? "",
        "Payment Year": s.payment_year ?? "",
        "Process Date": s.process_date ?? "",
        "Tax Period": s.tax_period ?? "",
        "Reference": s.reference ?? "",
        "Status": s.status ?? "",
        "Paid Date": s.paid_date ?? "",
        "Email": emp?.email_address ?? "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salaries");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `salaries-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
