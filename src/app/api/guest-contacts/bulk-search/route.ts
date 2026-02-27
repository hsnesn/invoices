import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";
import { runGuestContactSearch } from "@/lib/guest-contact-search";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const canAccess =
      profile.role === "admin" ||
      (Array.isArray(profile.allowed_pages) && (profile.allowed_pages as PageKey[]).includes("guest_contacts"));
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({
        error: "SERPER_API_KEY not configured. Add it in Vercel env for web search.",
      }, { status: 503 });
    }

    const body = (await request.json()) as { guest_names?: unknown[] };
    const names = Array.isArray(body?.guest_names) ? body.guest_names : [];
    const guestNames = names
      .filter((n: unknown): n is string => typeof n === "string")
      .map((n: string) => n.trim())
      .filter((n: string) => n.length >= 2);

    const unique = Array.from(new Set(guestNames));

    if (unique.length === 0) {
      return NextResponse.json({ error: "No guest names provided" }, { status: 400 });
    }

    if (unique.length > 100) {
      return NextResponse.json({ error: "Maximum 100 guests per bulk search" }, { status: 400 });
    }

    let done = 0;
    const errors: string[] = [];

    for (const name of unique) {
      try {
        await runGuestContactSearch(name);
      } catch (e) {
        errors.push(`${name}: ${(e as Error).message}`);
      }
      done++;
    }

    return NextResponse.json({
      message: `AI search completed for ${done} guest(s).`,
      total: unique.length,
      done,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
