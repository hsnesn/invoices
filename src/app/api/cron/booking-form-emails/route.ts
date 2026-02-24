/**
 * Cron: Process pending booking form emails (30s after form creation).
 * Vercel Cron calls this every minute.
 */
import { NextResponse } from "next/server";
import { processPendingBookingFormEmails } from "@/lib/booking-form/process-pending-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  // If CRON_SECRET is not set, allow unauthenticated (for external cron services)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { processed, errors } = await processPendingBookingFormEmails();
    return NextResponse.json({
      ok: true,
      processed,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    console.error("[Cron] booking-form-emails failed:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
