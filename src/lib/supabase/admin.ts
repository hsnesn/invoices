import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "@/lib/env.server";

/**
 * Server-side only. Uses service role key for admin operations.
 * NEVER expose this client or service role key to the client.
 */
export function createAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase URL or service role key");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
