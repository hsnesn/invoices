import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { canAccessInvoice } from "@/lib/invoice-access";
import JSZip from "jszip";

const BUCKET = "invoices";

function uniqueFileName(base: string, used: Set<string>): string {
  let fileName = base;
  while (used.has(fileName)) {
    const ext = fileName.includes(".") ? "." + fileName.split(".").pop() : "";
    const stem = fileName.replace(/\.[^.]+$/, "");
    fileName = `${stem}-${Math.random().toString(36).slice(2, 6)}${ext}`;
  }
  used.add(fileName);
  return fileName;
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const { invoice_ids } = (await request.json()) as { invoice_ids: string[] };

    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return NextResponse.json({ error: "No invoices selected" }, { status: 400 });
    }

    if (invoice_ids.length > 50) {
      return NextResponse.json({ error: "Maximum 50 invoices at once" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, storage_path, submitter_user_id")
      .in("id", invoice_ids);

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ error: "No invoices found" }, { status: 404 });
    }

    const { data: allFiles } = await supabase
      .from("invoice_files")
      .select("invoice_id, storage_path, file_name, sort_order")
      .in("invoice_id", invoice_ids)
      .order("sort_order", { ascending: true });

    const filesByInvoice = new Map<string, { storage_path: string; file_name: string }[]>();
    for (const f of allFiles ?? []) {
      const list = filesByInvoice.get(f.invoice_id) ?? [];
      list.push({ storage_path: f.storage_path, file_name: f.file_name });
      filesByInvoice.set(f.invoice_id, list);
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const inv of invoices) {
      const allowed = await canAccessInvoice(supabase, inv.id, session.user.id, {
        role: profile.role,
        department_id: profile.department_id,
        program_ids: profile.program_ids,
        full_name: profile.full_name ?? null,
      });
      if (!allowed) continue;

      const invoiceFiles = filesByInvoice.get(inv.id) ?? [];
      const hasMainInFiles = inv.storage_path && invoiceFiles.some((f) => f.storage_path === inv.storage_path);

      if (inv.storage_path && !hasMainInFiles) {
        const { data: fileData } = await supabase.storage.from(BUCKET).download(inv.storage_path);
        if (fileData) {
          const baseName = inv.storage_path.split("/").pop() ?? `invoice-${inv.id}.pdf`;
          const fileName = uniqueFileName(baseName, usedNames);
          zip.file(fileName, await fileData.arrayBuffer());
        }
      }

      for (const f of invoiceFiles) {
        const { data: fileData } = await supabase.storage.from(BUCKET).download(f.storage_path);
        if (!fileData) continue;
        const baseName = f.file_name || f.storage_path.split("/").pop() || `file-${inv.id}`;
        const fileName = uniqueFileName(baseName, usedNames);
        zip.file(fileName, await fileData.arrayBuffer());
      }
    }

    if (Object.keys(zip.files).length === 0) {
      return NextResponse.json({ error: "No accessible files" }, { status: 403 });
    }

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().split("T")[0]}.zip"`,
      },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
