import { NextResponse } from "next/server";
import { getCompanySettingsAsync } from "@/lib/company-settings";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Returns invitation-related defaults (studio_address, etc.) for any authenticated user. */
export async function GET() {
  try {
    await requireAuth();
    const settings = await getCompanySettingsAsync();
    return NextResponse.json({
      studio_address: settings.studio_address,
      invitation_subject_prefix: settings.invitation_subject_prefix,
      invitation_broadcast_channel: settings.invitation_broadcast_channel,
      invitation_body_intro: settings.invitation_body_intro,
      invitation_studio_intro: settings.invitation_studio_intro,
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
