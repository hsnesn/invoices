import { SalariesBoard } from "@/components/SalariesBoard";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SalariesPage() {
  const { profile } = await requireAuth();
  if (profile.role === "viewer") redirect("/dashboard");
  if (profile.role !== "admin" && profile.role !== "operations") {
    redirect("/dashboard");
  }

  const supabase = createAdminClient();
  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, badge_color")
    .order("full_name");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SalariesBoard employees={(employees ?? []).map((e) => ({ id: e.id, full_name: e.full_name, badge_color: e.badge_color }))} />
    </div>
  );
}
