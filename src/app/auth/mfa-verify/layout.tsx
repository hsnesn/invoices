import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Server-side session check for MFA page.
 * Ensures user has a session before showing the code form.
 * Client-side getSession can race with cookie propagation after login redirect.
 */
export default async function MfaVerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return <>{children}</>;
}
