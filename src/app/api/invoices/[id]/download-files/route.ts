import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { canAccessInvoice } from "@/lib/invoice-access";
import JSZip from "jszip";

const BUCKET = "invoices";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

    const allowed = await canAccessInvoice(supabase, invoiceId, session.user.id, {
      role: profile.role,
      department_id: profile.department_id,
      program_ids: profile.program_ids,
      full_name: profile.full_name ?? null,
    });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: inv } = await supabase.from("invoices").select("storage_path").eq("id", invoiceId).single();
    const { data: files } = await supabase
      .from("invoice_files")
      .select("storage_path, file_name, sort_order")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    const toDownload: { storage_path: string; file_name: string }[] = [];
    const hasMainInFiles = inv?.storage_path && (files ?? []).some((f) => f.storage_path === inv.storage_path);
    if (inv?.storage_path && !hasMainInFiles) {
      toDownload.push({
        storage_path: inv.storage_path,
        file_name: inv.storage_path.split("/").pop() ?? "invoice.pdf",
      });
    }
    for (const f of files ?? []) {
      toDownload.push({
        storage_path: f.storage_path,
        file_name: f.file_name || f.storage_path.split("/").pop() || "file",
      });
    }

    if (toDownload.length === 0) {
      return NextResponse.json({ error: "No files found" }, { status: 404 });
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();
    for (const { storage_path, file_name } of toDownload) {
      const { data: fileData } = await supabase.storage.from(BUCKET).download(storage_path);
      if (!fileData) continue;
      let name = file_name;
      while (usedNames.has(name)) {
        const ext = name.includes(".") ? "." + name.split(".").pop() : "";
        const stem = name.replace(/\.[^.]+$/, "");
        name = `${stem}-${Math.random().toString(36).slice(2, 6)}${ext}`;
      }
      usedNames.add(name);
      zip.file(name, await fileData.arrayBuffer());
    }

    if (Object.keys(zip.files).length === 0) {
      return NextResponse.json({ error: "No accessible files" }, { status: 403 });
    }

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="invoice-${invoiceId}-files.zip"`,
      },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
