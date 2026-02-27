import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuditLogClient } from "./AuditLogClient";

export default async function AuditLogPage() {
  const { profile } = await requireAuth();
  if (profile.role !== "admin") redirect("/dashboard");
  return <AuditLogClient />;
}
