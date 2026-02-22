import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { session, profile } = await requireAuth();

    let fullName = profile.full_name;

    if (!fullName) {
      const supabase = createAdminClient();
      const { data: authUser } = await supabase.auth.admin.getUserById(session.user.id);
      fullName = authUser?.user?.email?.split("@")[0] ?? null;
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
