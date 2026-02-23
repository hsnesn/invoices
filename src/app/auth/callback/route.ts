import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const next = requestUrl.searchParams.get("next");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription)}`, requestUrl.origin)
    );
  }

  const supabase = await createClient();
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    });
    if (error) {
      const { error: mlError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (mlError) {
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(mlError.message)}`, requestUrl.origin)
        );
      }
    }
  }

  const redirectTo = next && next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}
