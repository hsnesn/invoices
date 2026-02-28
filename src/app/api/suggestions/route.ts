import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = ["guest", "producer", "topic"] as const;
type Field = (typeof ALLOWED_FIELDS)[number];

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const field = searchParams.get("field") as Field | null;
    const q = searchParams.get("q")?.trim();

    if (!field || !ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json(
        { error: "field must be one of: guest, producer, topic" },
        { status: 400 },
      );
    }
    if (!q || q.length < 1) {
      return NextResponse.json({ suggestions: [] });
    }

    const supabase = createAdminClient();
    const pattern = `%${q}%`;
    let suggestions: string[] = [];

    if (field === "guest") {
      const { data, error } = await supabase
        .from("invoice_extracted_fields")
        .select("beneficiary_name")
        .ilike("beneficiary_name", pattern)
        .limit(8);
      if (error) throw error;
      suggestions = Array.from(
        new Set((data ?? []).map((r) => r.beneficiary_name).filter(Boolean)),
      );
    } else if (field === "producer") {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .in("role", ["submitter", "manager", "admin", "operations"])
        .ilike("full_name", pattern)
        .limit(8);
      if (error) throw error;
      suggestions = Array.from(
        new Set((data ?? []).map((r) => r.full_name).filter(Boolean)),
      );
    } else if (field === "topic") {
      const { data, error } = await supabase
        .from("topic_category_mapping")
        .select("raw_topic")
        .ilike("raw_topic", pattern)
        .limit(8);
      if (error) throw error;
      suggestions = Array.from(
        new Set((data ?? []).map((r) => r.raw_topic).filter(Boolean)),
      );
    }

    return NextResponse.json({ suggestions });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
