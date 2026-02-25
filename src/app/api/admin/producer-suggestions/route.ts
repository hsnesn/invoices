import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

function parseProducer(desc: string | null): string | null {
  if (!desc?.trim()) return null;
  for (const line of desc.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const sep = l.includes(":") ? ":" : l.includes("-") ? "-" : null;
    if (!sep) continue;
    const idx = l.indexOf(sep);
    if (idx === -1) continue;
    const key = l.slice(0, idx).trim().toLowerCase().replace(/\s+/g, " ");
    const val = l.slice(idx + 1).trim();
    if (key === "producer" || key === "producer name" || key === "prod") return val || null;
  }
  return null;
}

/** GET: Returns unique producer names from invoices (for color assignment suggestions). */
export async function GET() {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("invoices")
      .select("service_description")
      .neq("invoice_type", "freelancer");
    const unique = new Set<string>();
    (data ?? []).forEach((r: { service_description: string | null }) => {
      const p = parseProducer(r.service_description);
      if (p && p !== "—") unique.add(p.trim());
    });
    return NextResponse.json(Array.from(unique).sort());
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
