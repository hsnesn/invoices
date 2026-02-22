import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { session, profile } = await requireAuth();

    let fullName = profile.full_name;

    if (process.env.DEV_BYPASS_AUTH === "true" && (!fullName || fullName === "Dev Admin")) {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
      if (data?.full_name) fullName = data.full_name;
    }

    return NextResponse.json({
      id: profile.id,
      full_name: fullName,
      role: profile.role,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
