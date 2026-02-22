import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl, supabaseAnonKey } from "@/lib/env.server";

export async function createClient() {
  const cookieStore = await cookies();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `Supabase env missing (url_len=${supabaseUrl?.length ?? 0}, key_len=${supabaseAnonKey?.length ?? 0}, cwd=${process.cwd()})`
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}
