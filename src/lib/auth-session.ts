/**
 * Central session retrieval for API routes.
 * Use this instead of ad-hoc createClient().auth.getSession() to ensure consistent 401 handling.
 */
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@supabase/supabase-js";

export type SessionResult = { session: Session; error?: never } | { session: null; error: "unauthorized" | "deactivated" };

/**
 * Get session or return error. Does not redirect; caller should return 401.
 */
export async function getSessionOr401(): Promise<SessionResult> {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return { session: null, error: "unauthorized" };
  }

  return { session };
}
