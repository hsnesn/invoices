import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST() {
  try {
    await requireAdmin();

    return NextResponse.json({ 
      message: "Please run the migration SQL files manually in Supabase SQL Editor. Go to: https://supabase.com/dashboard/project/sdkihhmxwhqwmxhzmcpp/sql/new" 
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
