/**
 * Bulk import producer guests from CSV.
 * Expected columns: guest_name (required), email, title, program_name
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === "," || c === "\t") {
        current.push(cell.trim());
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        current.push(cell.trim());
        cell = "";
        if (current.some((x) => x)) rows.push(current);
        current = [];
      } else {
        cell += c;
      }
    }
  }
  if (cell || current.length) {
    current.push(cell.trim());
    if (current.some((x) => x)) rows.push(current);
  }
  return rows;
}

function findColumnIndex(headers: string[], names: string[]): number {
  const h = headers.map((x) => x.toLowerCase().trim());
  for (const n of names) {
    const idx = h.findIndex((x) => x.includes(n) || n.includes(x));
    if (idx >= 0) return idx;
  }
  return -1;
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const contentType = request.headers.get("content-type") ?? "";
    let text: string;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }
      text = await file.text();
    } else {
      const body = await request.json();
      const csv = (body as { csv?: string }).csv;
      if (!csv || typeof csv !== "string") {
        return NextResponse.json({ error: "Missing csv field" }, { status: 400 });
      }
      text = csv;
    }

    const rows = parseCsv(text);
    if (rows.length < 2) {
      return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
    }

    const headers = rows[0]!;
    const nameIdx = findColumnIndex(headers, ["guest_name", "guest name", "name"]);
    const emailIdx = findColumnIndex(headers, ["email", "e-mail"]);
    const titleIdx = findColumnIndex(headers, ["title"]);
    const programIdx = findColumnIndex(headers, ["program", "program_name", "program name"]);

    if (nameIdx < 0) {
      return NextResponse.json({ error: "CSV must have a 'guest_name' or 'name' column" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const toInsert: { producer_user_id: string; guest_name: string; email: string | null; title: string | null; program_name: string | null }[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const name = (row[nameIdx] ?? "").trim();
      if (!name || name.length < 2) {
        errors.push(`Row ${i + 1}: guest name is required (min 2 chars)`);
        continue;
      }
      const email = (emailIdx >= 0 ? row[emailIdx] ?? "" : "").trim() || null;
      const title = (titleIdx >= 0 ? row[titleIdx] ?? "" : "").trim() || null;
      const programName = (programIdx >= 0 ? row[programIdx] ?? "" : "").trim() || null;
      toInsert.push({
        producer_user_id: session.user.id,
        guest_name: name,
        email: email && email.includes("@") ? email : null,
        title,
        program_name: programName,
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No valid rows to import", details: errors }, { status: 400 });
    }

    const { data, error } = await supabase.from("producer_guests").insert(toInsert).select("id");
    if (error) throw error;

    return NextResponse.json({
      success: true,
      imported: data?.length ?? toInsert.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
