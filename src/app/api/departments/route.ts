import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    if (process.env.DEV_BYPASS_AUTH !== "true") {
      await requireAuth();
    }
    const supabase =
      process.env.DEV_BYPASS_AUTH === "true"
        ? createAdminClient()
        : await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
