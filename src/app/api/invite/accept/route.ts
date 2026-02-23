import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mark invitation as accepted when user completes password setup.
 * Called from /auth/accept-invite after successful updateUser({ password }).
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient();
    const { error } = await admin
      .from("user_invitations")
      .update({ accepted: true, accepted_at: new Date().toISOString() })
      .eq("email", user.email.toLowerCase())
      .eq("accepted", false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
