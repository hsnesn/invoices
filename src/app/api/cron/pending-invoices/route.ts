/**
 * Cron: SLA reminders + pending digest emails.
 * Call daily (e.g. 9am) via Vercel Cron or external scheduler.
 */
import { NextResponse } from "next/server";
import { runSlaReminders, runPendingDigest } from "@/lib/pending-invoices-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [slaResult, digestResult] = await Promise.all([
      runSlaReminders(),
      runPendingDigest(),
    ]);

    const errors = [...slaResult.errors, ...digestResult.errors];
    return NextResponse.json({
      ok: true,
      slaReminders: slaResult.slaReminders,
      digestEmails: digestResult.digestEmails,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    console.error("[Cron] pending-invoices failed:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
