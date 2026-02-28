/**
 * Export monthly schedule as PDF.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });

    const supabase = createAdminClient();
    const isManager = ["admin", "operations", "manager"].includes(profile.role);

    let query = supabase
      .from("output_schedule_assignments")
      .select("id, user_id, date, role, status")
      .gte("date", start)
      .lte("date", end)
      .order("date");

    if (!isManager) {
      query = query.eq("user_id", profile.id);
    }

    const { data: assignments } = await query;
    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      nameMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
    }

    const rows = (assignments ?? []).map((a: { user_id: string; date: string; role: string | null; status: string }) => [
      nameMap.get(a.user_id) ?? a.user_id.slice(0, 8),
      new Date(a.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      a.role || "—",
      a.status,
    ]);

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Schedule — ${monthLabel}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleDateString("en-GB")}`, 14, 28);

    if (rows.length > 0) {
      autoTable(doc, {
        head: [["Name", "Date", "Role", "Status"]],
        body: rows,
        startY: 35,
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
      });
    } else {
      doc.text("No assignments for this month.", 14, 40);
    }

    const buf = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="schedule-${month}.pdf"`,
      },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
