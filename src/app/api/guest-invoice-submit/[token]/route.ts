/**
 * Validate guest invoice submit token and return guest details for the form.
 * Public endpoint - no auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { getGuestSubmitTokenData } from "@/lib/guest-submit-token-data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await getGuestSubmitTokenData(token);
    if (result.ok) {
      return NextResponse.json(result.data);
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
