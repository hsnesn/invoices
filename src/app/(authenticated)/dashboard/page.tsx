import { requireAuth } from "@/lib/auth";
import { DashboardHome } from "@/components/DashboardHome";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile } = await requireAuth();
  return <DashboardHome profile={profile} />;
}
