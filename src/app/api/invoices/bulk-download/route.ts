import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { canAccessInvoice } from "@/lib/invoice-access";
import JSZip from "jszip";

const BUCKET = "invoices";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "invoice";
}

function monthSlug(monthStr: string | null, dateStr: string | null | undefined): string {
  if (monthStr && /\d{4}/.test(monthStr)) {
    const m = monthStr.replace(/\s+\d{4}$/, "").trim();
    const y = monthStr.match(/\d{4}/)?.[0] ?? "";
    const months: Record<string, string> = { january: "jan", february: "feb", march: "mar", april: "apr", may: "may", june: "jun", july: "jul", august: "aug", september: "sep", october: "oct", november: "nov", december: "dec" };
    const short = months[m.toLowerCase()] ?? m.slice(0, 3).toLowerCase();
    return `${short}-${y}`;
  }
  if (dateStr) {
    try {
      const d = new Date(dateStr);
      const m = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][d.getMonth()];
      return `${m}-${d.getFullYear()}`;
    } catch { /* */ }
  }
  return "unknown";
}

function parseServiceDescription(desc: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!desc) return result;
  for (const line of desc.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase();
      result[key] = line.slice(idx + 1).trim();
    }
  }
  return result;
}

function fromMeta(meta: Record<string, string>, aliases: string[], fallback = ""): string {
  for (const a of aliases) {
    const v = meta[a];
    if (v && v !== "—") return v;
  }
  return fallback;
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
      .select(`
        id, storage_path, submitter_user_id, invoice_type,
        service_description, service_date_from, service_date_to, created_at,
        invoice_extracted_fields(beneficiary_name),
        freelancer_invoice_fields(contractor_name, company_name, service_month)
      `)
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
    const seqByKey = new Map<string, number>();

    const getPersonAndMonth = (inv: (typeof invoices)[0]) => {
      const invTyp = (inv as { invoice_type?: string }).invoice_type;
      const extRaw = (inv as Record<string, unknown>).invoice_extracted_fields;
      const ext = Array.isArray(extRaw) ? extRaw[0] : extRaw;
      const flRaw = (inv as Record<string, unknown>).freelancer_invoice_fields;
      const fl = Array.isArray(flRaw) ? flRaw[0] : flRaw;
      const meta = parseServiceDescription((inv as { service_description?: string }).service_description ?? null);

      let person = "";
      let month = "";

      if (invTyp === "freelancer" && fl) {
        const flObj = fl as Record<string, unknown>;
        const contractor = (flObj.contractor_name as string) ?? "";
        const company = (flObj.company_name as string) ?? "";
        person = company && !/trt/i.test(company) ? `${company} ${contractor}`.trim() : contractor;
        month = monthSlug((flObj.service_month as string) ?? null, null);
      } else {
        person = (fromMeta(meta, ["guest name", "guest", "guest_name"]) || (ext as Record<string, string>)?.beneficiary_name) ?? "";
        month = monthSlug(fromMeta(meta, ["invoice date", "date"]) || null, ((inv as { service_date_to?: string }).service_date_to ?? (inv as { created_at?: string }).created_at) ?? null);
      }

      const personSlug = slugify(person || "unknown");
      const mon = month || monthSlug(null, (inv as { created_at?: string }).created_at ?? null);
      return { personSlug, monthKey: mon };
    };

    const nextFileName = (inv: (typeof invoices)[0], ext: string): string => {
      const { personSlug, monthKey } = getPersonAndMonth(inv);
      const key = `${personSlug}-${monthKey}`;
      const seq = (seqByKey.get(key) ?? 0) + 1;
      seqByKey.set(key, seq);
      let name = `${personSlug}-${monthKey}-${seq}`;
      if (ext) name += `.${ext}`;
      while (usedNames.has(name)) {
        name = `${personSlug}-${monthKey}-${seq}-${Math.random().toString(36).slice(2, 6)}${ext ? `.${ext}` : ""}`;
      }
      usedNames.add(name);
      return name;
    };

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
          const ext = inv.storage_path.split(".").pop()?.toLowerCase() || "pdf";
          const fileName = nextFileName(inv, ext);
          zip.file(fileName, await fileData.arrayBuffer());
        }
      }

      for (const f of invoiceFiles) {
        const { data: fileData } = await supabase.storage.from(BUCKET).download(f.storage_path);
        if (!fileData) continue;
        const ext = (f.file_name || f.storage_path).split(".").pop()?.toLowerCase() || "pdf";
        const fileName = nextFileName(inv, ext);
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
