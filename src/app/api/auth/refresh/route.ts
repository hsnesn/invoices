import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Refreshes the auth session. Call from client on app load to keep session fresh.
 * getUser() validates with Supabase and refreshes token if needed.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
