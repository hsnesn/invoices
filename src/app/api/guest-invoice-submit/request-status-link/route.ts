/**
 * Guest requests a new status link (e.g. lost or expired link).
 * Looks up their invoice by email and sends a new status link.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendStatusLinkEmail } from "@/lib/post-recording-emails";
import { checkRateLimit } from "@/lib/rate-limit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(request);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Find invoice by guest_email (existing token or raw_json)
    let invoiceId: string;
    let guestName: string;
    let programName: string;

    const { data: existingToken } = await supabase
      .from("guest_invoice_status_tokens")
      .select("invoice_id, guest_name, program_name")
      .ilike("guest_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingToken) {
      const row = existingToken as { invoice_id: string; guest_name?: string; program_name?: string };
      invoiceId = row.invoice_id;
      guestName = row.guest_name?.trim() || "Guest";
      programName = row.program_name?.trim() || "";
    } else {
      // 2. Find guest invoice by raw_json guest_email (case-insensitive)
      const { data: extRows } = await supabase
        .from("invoice_extracted_fields")
        .select("invoice_id, invoice_number, raw_json")
        .order("updated_at", { ascending: false })
        .limit(500);

      const matchingExt = (extRows ?? []).find((ext) => {
        const raw = ext.raw_json as { guest_email?: string } | null;
        return (raw?.guest_email ?? "").trim().toLowerCase() === email;
      });

      if (!matchingExt) {
        return NextResponse.json(
          { error: "No invoice found for this email address. Please check the email or contact support." },
          { status: 404 }
        );
      }

      const { data: inv } = await supabase
        .from("invoices")
        .select("id, service_description")
        .eq("id", matchingExt.invoice_id)
        .eq("invoice_type", "guest")
        .single();

      if (!inv) {
        return NextResponse.json(
          { error: "No invoice found for this email address. Please check the email or contact support." },
          { status: 404 }
        );
      }

      const desc = (inv as { service_description?: string }).service_description ?? "";
      const guestMatch = desc.match(/Guest:\s*([^\n]+)/);
      const progMatch = desc.match(/Program:\s*([^\n]+)/);
      const match = {
        id: (inv as { id: string }).id,
        guest_name: guestMatch?.[1]?.trim() || "Guest",
        program_name: progMatch?.[1]?.trim() || "",
      };

      invoiceId = match.id;
      guestName = match.guest_name;
      programName = match.program_name;
    }

    // Always create a new token so the user gets a fresh 7-day link (even when existing token is found)
    const newToken = crypto.randomUUID();
    const { error: insertErr } = await supabase.from("guest_invoice_status_tokens").insert({
      invoice_id: invoiceId,
      token: newToken,
      guest_email: email,
      guest_name: guestName,
      program_name: programName || null,
    });

    if (insertErr) {
      console.error("[Request status link] Insert failed:", insertErr);
      return NextResponse.json({ error: "Could not create status link. Please try again." }, { status: 500 });
    }

    const statusLink = `${APP_URL}/submit/status/${newToken}`;

    const { data: ext } = await supabase
      .from("invoice_extracted_fields")
      .select("invoice_number")
      .eq("invoice_id", invoiceId)
      .single();

    const invoiceNumber = (ext as { invoice_number?: string } | null)?.invoice_number ?? "—";

    await sendStatusLinkEmail({
      to: email,
      guestName,
      programName,
      invoiceNumber,
      statusLink,
    });

    return NextResponse.json({
      success: true,
      message: "A new status link has been sent to your email address.",
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    console.error("[Request status link] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
