import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { getFormatters, type ExportLocale } from "@/lib/export-locale";
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
    const name = searchParams.get("name");
    const locale = (searchParams.get("locale") === "tr" ? "tr" : "en") as ExportLocale;

    const supabase = createAdminClient();
    let query = supabase
      .from("salaries")
      .select("*, employees(full_name, bank_account_number, sort_code)")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (month) query = query.eq("payment_month", month);
    if (year) query = query.eq("payment_year", parseInt(year, 10));
    if (name?.trim()) query = query.ilike("employee_name", `%${name.trim()}%`);

    const { data: salaries, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { formatDate, formatCurrency } = getFormatters(locale);
    const rows = (salaries ?? []).map((s) => {
      const emp = s.employees as { full_name?: string; bank_account_number?: string; sort_code?: string } | null;
      const sortCode = s.sort_code ?? emp?.sort_code ?? "";
      const account = s.bank_account_number ?? emp?.bank_account_number ?? "";
      return {
        EMPLOYEE: s.employee_name ?? "",
        "NET PAY": s.net_pay != null ? formatCurrency(s.net_pay) : "",
        "SORT CODE": sortCode,
        ACCOUNT: account,
        REFERENCE: s.reference ?? "",
        MONTH: s.payment_month ?? "",
        DATE: formatDate(s.paid_date ?? s.process_date ?? null),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salaries");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", bookSST: true });

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
