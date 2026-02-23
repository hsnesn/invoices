import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const { profile } = await requireAuth();
  const allowed = profile.role === "admin" || profile.role === "viewer" || profile.allowed_pages?.includes("reports");
  if (!allowed) redirect("/dashboard");
  return <ReportsClient />;
}
