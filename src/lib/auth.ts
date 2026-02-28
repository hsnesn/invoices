import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { Profile, PageKey } from "@/lib/types";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  return data as Profile | null;
}

/** Require auth + active profile. Redirects to /login if not. */
export async function requireAuth(): Promise<{ session: { user: { id: string } }; profile: Profile }> {
  if (process.env.DEV_BYPASS_AUTH === "true") {
    const now = new Date().toISOString();
    const bypassUserId =
      process.env.DEV_BYPASS_USER_ID ??
      "54cc311f-9a5f-4e19-a94b-1ef7ed9c2266";
    return {
      session: { user: { id: bypassUserId } },
      profile: {
        id: bypassUserId,
        full_name: "Dev Admin",
        role: "admin",
        department_id: null,
        program_ids: [],
        allowed_pages: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) redirect("/login");

  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (profileError || !profile || !(profile as Profile).is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=deactivated");
  }

  return { session, profile: profile as Profile };
}

/** Require admin role. Redirects if not admin. */
export async function requireAdmin() {
  const { profile } = await requireAuth();
  if (profile.role !== "admin") redirect("/invoices");
  return { profile };
}

/** Require admin or operations role. Used for Setup APIs so operations can view/edit. */
export async function requireAdminOrOperations() {
  const { profile } = await requireAuth();
  if (profile.role !== "admin" && profile.role !== "operations") redirect("/invoices");
  return { profile };
}

/** Require page access per allowed_pages. Admin bypasses. Redirects to dashboard if not allowed. */
export async function requirePageAccess(pageKey: PageKey) {
  const { session, profile } = await requireAuth();
  if (profile.role === "admin") return { session, profile };
  // Guest contacts: admin only, or users explicitly granted by admin (allowed_pages)
  if (pageKey === "guest_contacts") {
    if (profile.allowed_pages?.includes("guest_contacts")) return { session, profile };
    redirect("/dashboard");
  }
  if (profile.role === "viewer" && ["guest_invoices", "freelancer_invoices", "reports"].includes(pageKey)) return { session, profile };
  if (pageKey === "invited_guests") {
    if (["admin", "viewer", "operations", "finance", "submitter", "manager"].includes(profile.role)) return { session, profile };
    if (profile.allowed_pages?.includes("invited_guests") || profile.allowed_pages?.includes("guest_invoices")) return { session, profile };
    if (!profile.allowed_pages || profile.allowed_pages.length === 0) return { session, profile };
    redirect("/dashboard");
  }
  if (pageKey === "other_invoices") {
    if (["admin", "finance", "operations"].includes(profile.role)) return { session, profile };
    if (profile.role === "viewer" && profile.allowed_pages?.includes("other_invoices")) return { session, profile };
    redirect("/dashboard");
  }
  if (pageKey === "contractor_availability") {
    if (["admin", "operations", "manager"].includes(profile.role)) return { session, profile };
    if (profile.allowed_pages?.includes("contractor_availability")) return { session, profile };
    if (!profile.allowed_pages || profile.allowed_pages.length === 0) return { session, profile };
    redirect("/dashboard");
  }
  if (pageKey === "request") {
    if (["admin", "operations", "manager"].includes(profile.role)) return { session, profile };
    redirect("/dashboard");
  }
  const pages = profile.allowed_pages;
  if (!pages || pages.length === 0) return { session, profile };
  if (pages.includes(pageKey)) return { session, profile };
  redirect("/dashboard");
}

/** Require Dev Admin (full_name "Dev Admin") - for Users page only. Redirects if not. */
export async function requireDevAdmin() {
  const { profile } = await requireAuth();
  if (profile.role !== "admin" || profile.full_name !== "Dev Admin") redirect("/invoices");
  return { profile };
}
