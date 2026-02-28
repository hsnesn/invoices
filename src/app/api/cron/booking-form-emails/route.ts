/**
 * Cron: Process pending booking form emails (30s after form creation).
 * Vercel Cron calls this every minute.
 */
import { NextResponse } from "next/server";
import { processPendingBookingFormEmails } from "@/lib/booking-form/process-pending-emails";
import { validateCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

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
