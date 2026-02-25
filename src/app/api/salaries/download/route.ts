import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/salaries/download?path=... - Download payslip file */
export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    if (!path || !path.startsWith("salaries/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from("invoices").download(path);

    if (error || !data) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const ext = path.split(".").pop() ?? "pdf";
    const contentType = ext === "pdf" ? "application/pdf" : "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="payslip.${ext}"`,
      },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
