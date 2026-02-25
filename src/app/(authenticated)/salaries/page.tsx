import { Suspense } from "react";
import { SalariesBoard } from "@/components/SalariesBoard";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SalariesPage() {
  const { profile } = await requireAuth();
  if (profile.role === "viewer") redirect("/dashboard");
  if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "finance") {
    redirect("/dashboard");
  }

  let employees: { id: string; full_name: string | null; badge_color: string | null }[] = [];
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name, badge_color")
      .order("full_name");
    if (!error && data) {
      employees = data.map((e) => ({ id: e.id, full_name: e.full_name, badge_color: e.badge_color }));
    }
  } catch {
    employees = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="animate-pulse rounded-xl bg-slate-200 h-64 dark:bg-slate-700" />}>
        <SalariesBoard
          profile={profile}
          employees={employees}
        />
      </Suspense>
    </div>
  );
}
