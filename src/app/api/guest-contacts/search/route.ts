import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";
import { runGuestContactSearch } from "@/lib/guest-contact-search";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const canAccess =
      profile.role === "admin" ||
      (Array.isArray(profile.allowed_pages) && (profile.allowed_pages as PageKey[]).includes("guest_contacts"));
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const guestName = typeof body?.guest_name === "string" ? body.guest_name.trim() : null;
    if (!guestName) {
      return NextResponse.json({ error: "guest_name is required" }, { status: 400 });
    }

    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({
        error: "SERPER_API_KEY not configured. Add it in Vercel env for web search.",
      }, { status: 503 });
    }

    await runGuestContactSearch(guestName);

    return NextResponse.json({
      message: "AI search completed. Results saved with AI warning.",
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
