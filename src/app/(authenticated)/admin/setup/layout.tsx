import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();
  if (profile.role === "viewer") redirect("/dashboard");
  if (profile.role !== "admin") redirect("/dashboard");
  return <>{children}</>;
}
