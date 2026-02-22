import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import JSZip from "jszip";

const BUCKET = "invoices";

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const { invoice_ids } = (await request.json()) as { invoice_ids: string[] };

    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return NextResponse.json({ error: "No invoices selected" }, { status: 400 });
    }

    if (invoice_ids.length > 50) {
      return NextResponse.json({ error: "Maximum 50 files at once" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, storage_path, submitter_user_id")
      .in("id", invoice_ids);

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ error: "No invoices found" }, { status: 404 });
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const inv of invoices) {
      if (!inv.storage_path) continue;

      if (profile.role !== "admin") {
        if (inv.submitter_user_id !== session.user.id) {
          const { data: wf } = await supabase
            .from("invoice_workflows")
            .select("manager_user_id")
            .eq("invoice_id", inv.id)
            .single();
          if (wf?.manager_user_id !== session.user.id && profile.role !== "finance") {
            continue;
          }
        }
      }

      const { data: fileData } = await supabase.storage
        .from(BUCKET)
        .download(inv.storage_path);

      if (!fileData) continue;

      let fileName = inv.storage_path.split("/").pop() ?? `invoice-${inv.id}`;
      while (usedNames.has(fileName)) {
        const ext = fileName.includes(".") ? "." + fileName.split(".").pop() : "";
        const stem = fileName.replace(/\.[^.]+$/, "");
        fileName = `${stem}-${Math.random().toString(36).slice(2, 6)}${ext}`;
      }
      usedNames.add(fileName);

      const buffer = await fileData.arrayBuffer();
      zip.file(fileName, buffer);
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
